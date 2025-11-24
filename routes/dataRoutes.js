import express from "express";
import {
  getDistrictData,
  refreshDistrictDataController,
} from "../controllers/dataController.js";
import { generateAISummaryController } from "../controllers/dataController.js";

const router = express.Router();

// Fetch summary + AI insight + optional cache
router.get("/:districtName", getDistrictData);

// Force refresh from API
router.get("/:districtName/refresh", refreshDistrictDataController);

router.get("/:districtName/ai-summary", generateAISummaryController);

export default router;
