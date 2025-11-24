import axios from "axios";
import DistrictData from "../models/districtDataModel.js";
import generateAiInsight from "../ai/insightGenerator.js";

// Validate environment variables
if (!process.env.API_KEY || !process.env.RESOURCE_ID) {
  throw new Error("Missing API Key or Resource Id in environment variables");
}

// Helper function
async function fetchPage(offset, limit, retries = 3) {
  const url = `https://api.data.gov.in/resource/${process.env.RESOURCE_ID}?api-key=${process.env.API_KEY}&format=json&limit=${limit}&offset=${offset}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, { timeout: 15000 });
      return response.data.records || [];
    } catch (err) {
      console.warn(
        `⚠️ Retry ${attempt}/${retries} at offset ${offset}: ${err.message}`
      );
      if (attempt === retries) return [];
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }

  return [];
}

function summarizedData(records) {
  if (!records || records.length === 0) {
    return { message: "No data available for this district" };
  }

  const r = records[0];

  return {
    financialYear: r.fin_year,
    month: r.month,
    totalWorksTakenUp: Number(r.Total_No_of_Works_Takenup) || 0,
    completedWorks: Number(r.Number_of_Completed_Works) || 0,
    ongoingWorks: Number(r.Number_of_Ongoing_Works) || 0,
    totalHouseholdsWorked: Number(r.Total_Households_Worked) || 0,
    totalIndividualsWorked: Number(r.Total_Individuals_Worked) || 0,
    totalJobCardsIssued: Number(r.Total_No_of_JobCards_issued) || 0,
    totalActiveJobCards: Number(r.Total_No_of_Active_Job_Cards) || 0,
    totalActiveWorkers: Number(r.Total_No_of_Active_Workers) || 0,
    totalPersonDays: Number(r.Persondays_of_Central_Liability_so_far) || 0,
    scPersonDays: Number(r.SC_persondays) || 0,
    stPersonDays: Number(r.ST_persondays) || 0,
    womenPersonDays: Number(r.Women_Persondays) || 0,
    avgWageRate: Number(r.Average_Wage_rate_per_day_per_person) || 0,
    avgDaysEmployment:
      Number(r.Average_days_of_employment_provided_per_Household) || 0,
    totalExpenditure: Number(r.Total_Exp) || 0,
    adminExpenditure: Number(r.Total_Adm_Expenditure) || 0,
    materialWages: Number(r.Material_and_skilled_Wages) || 0,
    wageExpenditure: Number(r.Wages) || 0,
    percentAgriAlliedWorks:
      Number(r.percent_of_Expenditure_on_Agriculture_Allied_Works) || 0,
    percentNRMExpenditure: Number(r.percent_of_NRM_Expenditure) || 0,
    timelyPaymentsPercent:
      Number(r.percentage_payments_gererated_within_15_days) || 0,
  };
}

// ------------------ CONTROLLERS -------------------------

export const getDistrictData = async (req, res) => {
  try {
    const { districtName } = req.params;

    if (!districtName) {
      return res.status(400).json({ message: "District name is required" });
    }

    const normalizedName = districtName.trim().toLowerCase();

    // Check cache
    const district = await DistrictData.findOne({
      districtName: normalizedName,
    });
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (
      district &&
      district.data?.length > 0 &&
      district.lastUpdated > oneDayAgo
    ) {
      const summary = summarizedData(district.data);
      const aiInsight = await generateAiInsight(summary);

      return res.status(200).json({
        source: "Cache",
        lastUpdated: district.lastUpdated,
        summary,
        aiInsight,
        data: district.data,
      });
    }

    console.time("Total Request");
    console.time("API Fetch");

    // Fetch from API
    let limit = 1000;
    let offset = 0;
    let districtData = [];
    let districtFound = false;

    while (!districtFound) {
      const records = await fetchPage(offset, limit);
      if (records.length === 0) break;

      const filtered = records.filter(
        (r) => r.district_name?.trim().toLowerCase() === normalizedName
      );

      if (filtered.length > 0) {
        console.log(`✅ Found district data at offset ${offset}`);
        districtData = filtered;
        districtFound = true;
        break;
      }

      offset += limit;
    }

    console.timeEnd("API Fetch");

    if (!districtFound) {
      return res
        .status(404)
        .json({ message: "District not found in API data" });
    }

    const summary = summarizedData(districtData);
    const aiInsight = await generateAiInsight(summary);

    // Save to DB
    await DistrictData.findOneAndUpdate(
      { districtName: normalizedName },
      { data: districtData, lastUpdated: new Date() },
      { upsert: true }
    );

    console.timeEnd("Total Request");

    res.status(200).json({
      source: "API",
      summary,
      aiInsight,
      data: districtData,
    });
  } catch (err) {
    console.error("❌ Error in getDistrictData:", err.message);
    res.status(500).json({ message: "Server error: " + err.message });
  }
};

export const refreshDistrictDataController = async (req, res) => {
  try {
    const { districtName } = req.params;

    if (!districtName) {
      return res.status(400).json({ error: "District Name is Required" });
    }

    const normalizedName = districtName.trim().toLowerCase();
    console.log(`District : ${districtName}`);

    await DistrictData.findOneAndDelete({ districtName: normalizedName });

    let limit = 1000;
    let offset = 0;
    let districtData = [];
    let districtFound = false;

    console.time("Total Request");
    console.time("API Fetch");

    while (!districtFound) {
      const records = await fetchPage(offset, limit);
      if (records.length === 0) break;

      const filtered = records.filter(
        (r) => r.district_name?.trim().toLowerCase() === normalizedName
      );

      if (filtered.length > 0) {
        districtData = filtered;
        districtFound = true;
        break;
      }

      offset += limit;
    }

    console.timeEnd("API Fetch");

    if (!districtFound) {
      return res
        .status(404)
        .json({ message: "District not found in API data" });
    }

    const summary = summarizedData(districtData);
    const aiInsight = await generateAiInsight(summary);

    await DistrictData.findOneAndUpdate(
      { districtName: normalizedName },
      { data: districtData, lastUpdated: new Date() },
      { upsert: true }
    );

    console.timeEnd("Total Request");

    res.status(200).json({
      source: "API",
      summary,
      aiInsight,
      data: districtData,
    });
  } catch (err) {
    console.error("❌ Error in refreshDistrictDataController:", err.message);
    res.status(500).json({ message: "Server error: " + err.message });
  }
};

export const generateAISummaryController = async (req, res) => {
  try {
    const { districtName } = req.params;
    const normalizedName = districtName.trim().toLowerCase();

    const district = await DistrictData.findOne({
      districtName: normalizedName,
    });

    if (!district) {
      return res.status(404).json({ message: "No cached data to summarize." });
    }

    const summary = summarizedData(district.data);
    const aiInsight = await generateAiInsight(summary);

    res.status(200).json({
      district: normalizedName,
      summary,
      aiInsight,
    });
  } catch (err) {
    res.status(500).json({ message: "AI summary error: " + err.message });
  }
};
