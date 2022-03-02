"use strict";
const { User, Otp } = require("../../models");
const userModel = User;
const OtpModel = Otp;
const errorHandler = require("../../utils/errorHandler");
const responseSender = require("../../utils/responseSender");
const authService = require("../../auth/auth.service");
const dates = require("../../utils/dates");

async function sendOtpToMobileNumber(user_id, country_code, mobile_number) {
  /****Sms Gateway needs to be implemented****/

  //Secs time for verification otp
  const now = new Date();
  const expiration_time = dates.addSecondsToDate(now, 300);
  const otp_obj = {
    user_id: user_id,
    otp: 123456,
    expiration_time: expiration_time,
  };
  const otp = await OtpModel.create(otp_obj);
  if (otp) {
    //Choose message template accordingily

    const details = {
      timestamp: now,
      success: true,
      message: "OTP sent to user.",
      otp_id: otp.id,
    };

    // Encrypt the details object
    //const encoded = await encrypt(JSON.stringify(details));
    return details;
  } else {
    const errObj = {
      details: "Failed to store otp",
    };
    errorHandler(req, res, errObj, 500);
  }
}

async function findUser(mobile_number, country_code) {
  const userFound = await userModel.findOne({
    where: {
      mobile_number: mobile_number,
      country_code: country_code,
    },
  });
  if (userFound) {
    return userFound;
  } else {
    return false;
  }
}

/****************API FUNCTIONS ***************************/
async function create(req, res) {
  try {
    const { mobile_number, country_code } = req.body;
    //checking mobile number existed, if not creating
    const user = await findUser(mobile_number, country_code);
    if (user) {
      //SendVerficationCode, calling sms gateway
      const details = await sendOtpToMobileNumber(
        user.id,
        user.country_code,
        mobile_number
      );
      if (details) {
        return responseSender(
          req,
          res,
          { otp_details: details, user_details: user.dataValues },
          200,
          "Existed user."
        );
      }
    } else {
      const user = await userModel.create({
        mobile_number: mobile_number,
        country_code: country_code,
      });
      if (user) {
        //SendVerficationCode, calling sms gateway
        const details = await sendOtpToMobileNumber(
          user.id,
          country_code,
          mobile_number
        );
        if (details) {
          return responseSender(
            req,
            res,
            { otp_details: details, user: user },
            201,
            "User created successfully, OTP sent to user."
          );
        }
      }
    }
  } catch (error) {
    console.log(error)
    const errObj = { msg: error };
    return errorHandler(req, res, errObj, 500);
  }
}
async function verifyOtp(req, res) {
  try {
    const { mobile_number, country_code, otp_details } = req.body;
    const user = await findUser(mobile_number, country_code);
    if (!user) {
      const errObj = { message: "User not found." };
      return errorHandler(req, res, errObj, 401);
    } else {
      try {
        const otp_instance = await OtpModel.findOne({
          where: { id: otp_details.otp_id },
        });
        //Check if OTP is available in the DB
        if (otp_instance != null) {
          //Check if OTP is equal to the OTP in the DB
          if (otp_details.OTP === otp_instance.otp) {
            //Check if OTP is already used or not
            if (otp_instance.verified != true) {
              //Check if OTP is expired or not
              const currentdate = new Date();
              if (
                dates.compare(otp_instance.expiration_time, currentdate) == 1
              ) {
                // Mark OTP as verified or used
                otp_instance.verified = true;
                otp_instance.save();
                let data = {
                  user: user,
                  token: authService.signToken({
                    _id: user.id,
                    mobile_number: user.mobile_number,
                  }),
                };
                responseSender(req, res, data, 200, "OTP Matched");
              } else {
                const errObj = { message: "OTP Expired" };
                return errorHandler(req, res, errObj, 401);
              }
            } else {
              const errObj = { message: "OTP Already Used" };
              return errorHandler(req, res, errObj, 401);
            }
          } else {
            const errObj = {
              message: "OTP NOT Matched",
            };
            return errorHandler(req, res, errObj, 401);
          }
        } else {
          const errObj = { message: "OTP record not found." };
          return errorHandler(req, res, errObj, 401);
        }
      } catch (err) {
        const errObj = { details: "Bad Request" };
        return errorHandler(req, res, errObj, 401);
      }
    }
  } catch (error) {
    errorHandler(req, res, { msg: "Unknown error" }, 500);
  }
}
async function details(req, res) {
  try {
    let userDetails = {};
    const id = req.user._id;
    if (req.body.name) {
      userDetails.first_name = req.body.name;
    }
    if (req.body.email) {
      userDetails.email = req.body.email;
    }
    if (req.body.gender) {
      userDetails.gender = req.body.gender;
    }
    if (req.body.facebook) {
      userDetails.facebook = req.body.facebook;
    }
    if (req.body.linkedin) {
      userDetails.linkedin = req.body.linkedin;
    }
    if (req.body.instagram) {
      userDetails.instagram = req.body.instagram;
    }
    const details = await userModel.update(userDetails, {
      where: {
        id: id,
      },
    });
    if (details[0]) {
      const user_details = await userModel.findOne({ id: id });
      return responseSender(
        req,
        res,
        { user: user_details },
        200,
        "User details saved."
      );
    } else {
      return errorHandler(req, res, {}, 404, "No record modified.");
    }
  } catch (error) {
    const errObj = { errObj: error };
    return errorHandler(req, res, errObj, 500);
  }
}
module.exports = { create, verifyOtp, details };