import mongoose from "mongoose";

const { Schema } = mongoose;

const districtDataSchema = new Schema({
  districtName: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },

  // Optional fields for future expansion
  stateName: {
    type: String,
    required: false,
  },
  month: {
    type: String,
    required: false,
  },
  year: {
    type: Number,
    required: false,
  },

  // The API returns an ARRAY of records
  data: {
    type: Array,
    default: [],
  },

  // Cache expires in 24 hours
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

const DistrictData = mongoose.model("DistrictData", districtDataSchema);
export default DistrictData;
