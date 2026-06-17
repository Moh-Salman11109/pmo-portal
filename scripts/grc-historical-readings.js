// ═══════════════════════════════════════════════════════════════════════════
//  Tree Digital Insurance — GRC Historical KRI Readings Import
//
//  WHAT THIS DOES:
//    1. Ensures Justification + ActionPlan columns exist on GRC_KRI_Readings (Notes)
//    2. Sets ReportingFrequency = "Quarterly" for 85 KRIs with historical data
//    3. Inserts 409 historical readings covering 2025-Q1 → 2026-Q1
//
//  HOW TO RUN
//    1. Open https://treedigitalinsurance.sharepoint.com/sites/GRC-Dashboard
//    2. Open DevTools console (F12)
//    3. Paste this entire script and press Enter
//    4. Wait — total time ~7-10 minutes
//
//  IDEMPOTENT: re-running adds the columns once (skips if present), updates
//  frequencies, and re-inserts readings (will create duplicates if re-run —
//  delete from list view first if you need a clean re-run).
// ═══════════════════════════════════════════════════════════════════════════

const READINGS = [
  {
    "KRIID": "KRI-001",
    "KRIName": "Failure to obtain approval from IA on material outsourcing",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Evidence attached through the GRC shared Folder",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-002",
    "KRIName": "Absence of proof of approval obtained by Tawuniya from IA prior to launch of new product or changes in existing product",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "There was no new products launch during Q4-2024",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-003",
    "KRIName": "Communication of new regulation to business departments",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Evidence attached through the GRC shared Folder",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-004",
    "KRIName": "Regulatory reporting",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-005",
    "KRIName": "Regulatory breaches",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-006",
    "KRIName": "Regulatory fines and penalty",
    "Period": "2025-Q1",
    "ActualValue": 1,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-007",
    "KRIName": "Failure to perform Customer Due Diligence",
    "Period": "2025-Q1",
    "ActualValue": "No Data",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "KYC preforming principle\r\nRetrieved client info from trusted sources during onboarding stage (ELM)\r\nScreened clients names against sanction list (Obtain from SAS)",
    "ActionPlan": "Evidence to be check with IT team"
  },
  {
    "KRIID": "KRI-008",
    "KRIName": "Non submission of Suspicious Transaction Reporting",
    "Period": "2025-Q1",
    "ActualValue": "No Data",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "Tawuniya is reporting suspcious cases for TAW and Tree. Not able to extract Files from TAW for Tree STR",
    "ActionPlan": "To request finance access for Transaction Monitoring"
  },
  {
    "KRIID": "KRI-001",
    "KRIName": "Failure to obtain approval from IA on material outsourcing",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "N/A",
    "Justification": "N/A",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-002",
    "KRIName": "Absence of proof of approval obtained by Tawuniya from IA prior to launch of new product or changes in existing product",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "N/A",
    "Justification": "N/A",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-003",
    "KRIName": "Communication of new regulation to business departments",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "N/A",
    "Justification": "N/A",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-004",
    "KRIName": "Regulatory reporting",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "N/A",
    "Justification": "N/A",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-005",
    "KRIName": "Regulatory breaches",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "N/A",
    "Justification": "N/A",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-006",
    "KRIName": "Regulatory fines and penalty",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "N/A",
    "Justification": "N/A",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-007",
    "KRIName": "Failure to perform Customer Due Diligence",
    "Period": "2026-Q1",
    "ActualValue": "No Data",
    "RAGStatus": "Red",
    "Comments": "N/A",
    "Justification": "KYC preforming principle\r\nRetrieved client info from trusted sources during onboarding stage (ELM)\r\nScreened clients names against sanction list (Obtain from SAS)",
    "ActionPlan": "Evidence to be checked with IT team\r\nWorking on selecting AML system provider to cover the required"
  },
  {
    "KRIID": "KRI-008",
    "KRIName": "Non submission of Suspicious Transaction Reporting",
    "Period": "2026-Q1",
    "ActualValue": "No Data",
    "RAGStatus": "Red",
    "Comments": "N/A",
    "Justification": "Tawuniya is reporting suspcious cases for TAW and Tree. Not able to extract Files from TAW for Tree STR",
    "ActionPlan": "To request finance access for Transaction Monitoring\r\nWorking on selecting AML system provider to cover the required"
  },
  {
    "KRIID": "KRI-001",
    "KRIName": "Failure to obtain approval from IA on material outsourcing",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Evidence attached through the GRC shared Folder",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-002",
    "KRIName": "Absence of proof of approval obtained by Tawuniya from IA prior to launch of new product or changes in existing product",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "There was no new products launch during Q4-2024",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-003",
    "KRIName": "Communication of new regulation to business departments",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Evidence attached through the GRC shared Folder",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-004",
    "KRIName": "Regulatory reporting",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-005",
    "KRIName": "Regulatory breaches",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-006",
    "KRIName": "Regulatory fines and penalty",
    "Period": "2025-Q2",
    "ActualValue": 1,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-007",
    "KRIName": "Failure to perform Customer Due Diligence",
    "Period": "2025-Q2",
    "ActualValue": "No Data",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "KYC preforming principle\r\nRetrieved client info from trusted sources during onboarding stage (ELM)\r\nScreened clients names against sanction list (Obtain from SAS)",
    "ActionPlan": "Evidence to be check with IT team"
  },
  {
    "KRIID": "KRI-008",
    "KRIName": "Non submission of Suspicious Transaction Reporting",
    "Period": "2025-Q2",
    "ActualValue": "No Data",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "Tawuniya is reporting suspcious cases for TAW and Tree. Not able to extract Files from TAW for Tree STR",
    "ActionPlan": "To request finance access for Transaction Monitoring"
  },
  {
    "KRIID": "KRI-001",
    "KRIName": "Failure to obtain approval from IA on material outsourcing",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Evidence attached through the GRC shared Folder",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-002",
    "KRIName": "Absence of proof of approval obtained by Tawuniya from IA prior to launch of new product or changes in existing product",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "There was no new products launch during Q4-2024",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-003",
    "KRIName": "Communication of new regulation to business departments",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Evidence attached through the GRC shared Folder",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-004",
    "KRIName": "Regulatory reporting",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-005",
    "KRIName": "Regulatory breaches",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-006",
    "KRIName": "Regulatory fines and penalty",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-007",
    "KRIName": "Failure to perform Customer Due Diligence",
    "Period": "2025-Q3",
    "ActualValue": "No Data",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "KYC preforming principle\r\nRetrieved client info from trusted sources during onboarding stage (ELM)\r\nScreened clients names against sanction list (Obtain from SAS)",
    "ActionPlan": "Evidence to be checked with IT team"
  },
  {
    "KRIID": "KRI-008",
    "KRIName": "Non submission of Suspicious Transaction Reporting",
    "Period": "2025-Q3",
    "ActualValue": "No Data",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "Tawuniya is reporting suspcious cases for TAW and Tree. Not able to extract Files from TAW for Tree STR",
    "ActionPlan": "To request finance access for Transaction Monitoring"
  },
  {
    "KRIID": "KRI-001",
    "KRIName": "Failure to obtain approval from IA on material outsourcing",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-002",
    "KRIName": "Absence of proof of approval obtained by Tawuniya from IA prior to launch of new product or changes in existing product",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-003",
    "KRIName": "Communication of new regulation to business departments",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-004",
    "KRIName": "Regulatory reporting",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-005",
    "KRIName": "Regulatory breaches",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-006",
    "KRIName": "Regulatory fines and penalty",
    "Period": "2025-Q4",
    "ActualValue": 1,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-007",
    "KRIName": "Failure to perform Customer Due Diligence",
    "Period": "2025-Q4",
    "ActualValue": "No Data",
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "KYC preforming principle\r\nRetrieved client info from trusted sources during onboarding stage (ELM)\r\nScreened clients names against sanction list (Obtain from SAS)",
    "ActionPlan": "Evidence to be checked with IT team\r\nWorking on selecting AML system provider to cover the required"
  },
  {
    "KRIID": "KRI-008",
    "KRIName": "Non submission of Suspicious Transaction Reporting",
    "Period": "2025-Q4",
    "ActualValue": "No Data",
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "Tawuniya is reporting suspcious cases for TAW and Tree. Not able to extract Files from TAW for Tree STR",
    "ActionPlan": "To request finance access for Transaction Monitoring\r\nWorking on selecting AML system provider to cover the required"
  },
  {
    "KRIID": "KRI-009",
    "KRIName": "Average Claim Settlement Time",
    "Period": "2026-Q1",
    "ActualValue": 1.26,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-010",
    "KRIName": "Claims recovery ratio",
    "Period": "2026-Q1",
    "ActualValue": 29,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-011",
    "KRIName": "Claims settled outside policy period",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-013",
    "KRIName": "Individual Claim settlement (Excluding Fraud claims)",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-013",
    "KRIName": "Individual Claim settlement (Excluding Fraud claims)",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-014",
    "KRIName": "Corporate Claim settlement (Excluding Fraud claims)",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-015",
    "KRIName": "Claims payout against cases tagged as fraudulent claims",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-016",
    "KRIName": "Increase in number of confirmed fraudulent claims",
    "Period": "2026-Q1",
    "ActualValue": 2.51,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-017",
    "KRIName": "Identifying fraudulent claims",
    "Period": "2026-Q1",
    "ActualValue": "No data available",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "currently, the system does not show the cases that were sent to authorities for investigation",
    "ActionPlan": "To enhance the internal system (Byteforce) to show the opened investigated cases"
  },
  {
    "KRIID": "KRI-018",
    "KRIName": "Duplicate claims settled",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-019",
    "KRIName": "Claims settled without required documentation",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-020",
    "KRIName": "Claim settlement ratio",
    "Period": "2026-Q1",
    "ActualValue": 97.53,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-009",
    "KRIName": "Average Claim Settlement Time",
    "Period": "2025-Q2",
    "ActualValue": 3.8,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-010",
    "KRIName": "Claims recovery ratio",
    "Period": "2025-Q2",
    "ActualValue": 47,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-011",
    "KRIName": "Claims settled outside policy period",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-013",
    "KRIName": "Individual Claim settlement (Excluding Fraud claims)",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-013",
    "KRIName": "Individual Claim settlement (Excluding Fraud claims)",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-014",
    "KRIName": "Corporate Claim settlement (Excluding Fraud claims)",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-015",
    "KRIName": "Claims payout against cases tagged as fraudulent claims",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-016",
    "KRIName": "Increase in number of confirmed fraudulent claims",
    "Period": "2025-Q2",
    "ActualValue": 1,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-017",
    "KRIName": "Identifying fraudulent claims",
    "Period": "2025-Q2",
    "ActualValue": "No data available",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "currently, the system does not show the cases that were sent to authorities for investigation",
    "ActionPlan": "To enhance the internal system (Byteforce) to show the opened investigated cases"
  },
  {
    "KRIID": "KRI-018",
    "KRIName": "Duplicate claims settled",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-019",
    "KRIName": "Claims settled without required documentation",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-020",
    "KRIName": "Claim settlement ratio",
    "Period": "2025-Q2",
    "ActualValue": 95.25,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-009",
    "KRIName": "Average Claim Settlement Time",
    "Period": "2025-Q3",
    "ActualValue": 2,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-010",
    "KRIName": "Claims recovery ratio",
    "Period": "2025-Q3",
    "ActualValue": 48.78,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-011",
    "KRIName": "Claims settled outside policy period",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-013",
    "KRIName": "Individual Claim settlement (Excluding Fraud claims)",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-013",
    "KRIName": "Individual Claim settlement (Excluding Fraud claims)",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-014",
    "KRIName": "Corporate Claim settlement (Excluding Fraud claims)",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-015",
    "KRIName": "Claims payout against cases tagged as fraudulent claims",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-016",
    "KRIName": "Increase in number of confirmed fraudulent claims",
    "Period": "2025-Q3",
    "ActualValue": 1.96,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-017",
    "KRIName": "Identifying fraudulent claims",
    "Period": "2025-Q3",
    "ActualValue": "No data available",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "currently, the system does not show the cases that were sent to authorities for investigation",
    "ActionPlan": "To enhance the internal system (Byteforce) to show the opened investigated cases"
  },
  {
    "KRIID": "KRI-018",
    "KRIName": "Duplicate claims settled",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-019",
    "KRIName": "Claims settled without required documentation",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-020",
    "KRIName": "Claim settlement ratio",
    "Period": "2025-Q3",
    "ActualValue": 98.55,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-009",
    "KRIName": "Average Claim Settlement Time",
    "Period": "2025-Q4",
    "ActualValue": 1.507,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-010",
    "KRIName": "Claims recovery ratio",
    "Period": "2025-Q4",
    "ActualValue": 57.26,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-011",
    "KRIName": "Claims settled outside policy period",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-013",
    "KRIName": "Individual Claim settlement (Excluding Fraud claims)",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-013",
    "KRIName": "Individual Claim settlement (Excluding Fraud claims)",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-014",
    "KRIName": "Corporate Claim settlement (Excluding Fraud claims)",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-015",
    "KRIName": "Claims payout against cases tagged as fraudulent claims",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-016",
    "KRIName": "Increase in number of confirmed fraudulent claims",
    "Period": "2025-Q4",
    "ActualValue": 3.15,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-017",
    "KRIName": "Identifying fraudulent claims",
    "Period": "2025-Q4",
    "ActualValue": "No data available",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "currently, the system does not show the cases that were sent to authorities for investigation",
    "ActionPlan": "To enhance the internal system (Byteforce) to show the opened investigated cases"
  },
  {
    "KRIID": "KRI-018",
    "KRIName": "Duplicate claims settled",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-019",
    "KRIName": "Claims settled without required documentation",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-020",
    "KRIName": "Claim settlement ratio",
    "Period": "2025-Q4",
    "ActualValue": 97.72,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-009",
    "KRIName": "Average Claim Settlement Time",
    "Period": "2025-Q1",
    "ActualValue": 9.52,
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "Refer to IA response",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-011",
    "KRIName": "Claims settled outside policy period",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-013",
    "KRIName": "Individual Claim settlement (Excluding Fraud claims)",
    "Period": "2025-Q1",
    "ActualValue": 1992,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "Company tightened anti-fraud procedures due to rise in suspicious claims.\r\nVerified claims using approved technical systems to protect rights.\r\nUpdated monitoring processes and built an internal tracking panel\r\nImproved efficiency and restored timely claim settlements.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-013",
    "KRIName": "Individual Claim settlement (Excluding Fraud claims)",
    "Period": "2025-Q1",
    "ActualValue": 583,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-014",
    "KRIName": "Corporate Claim settlement (Excluding Fraud claims)",
    "Period": "2025-Q1",
    "ActualValue": 2,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-015",
    "KRIName": "Claims payout against cases tagged as fraudulent claims",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-017",
    "KRIName": "Identifying fraudulent claims",
    "Period": "2025-Q1",
    "ActualValue": "No data available",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "currently, the system does not show the cases that were sent to authorities for investigation",
    "ActionPlan": "To enhance the internal system (Byteforce) to show the opened investigated cases"
  },
  {
    "KRIID": "KRI-018",
    "KRIName": "Duplicate claims settled",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-019",
    "KRIName": "Claims settled without required documentation",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-020",
    "KRIName": "Claim settlement ratio",
    "Period": "2025-Q1",
    "ActualValue": 97.24,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-021",
    "KRIName": "Low First Call Resolution",
    "Period": "2025-Q2",
    "ActualValue": "(Number of First Call Resolutions / : 8380\r\nTotal Number of Inbound Calls attended) : 16604 =50.47%",
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "In the last quarter, we transitioned from the Odoo system to the new iDesk platform. While the shift initially caused some delays in complaint resolution and an increase in repeated calls—contributing to a temporary drop in First Call Resolution it was a necessary step toward improving overall system performance. The new platform is designed to streamline internal workflows, unify all customer service channels, and enhance long-term service efficiency.",
    "ActionPlan": "The new system will be in place as we are waiting IA approval for iDesk. Enhancements are still ongoing, and we expect a significant improvement in overall performance, along with faster complaint resolution as well as high FCR ratio across all service channels."
  },
  {
    "KRIID": "KRI-022",
    "KRIName": "High Abandon calls",
    "Period": "2025-Q2",
    "ActualValue": "(Number of Abandon calls : 1561 \r\nTotal Number of Inbound Calls) : 18258= 8.55%",
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "The call answer time was set to 3 seconds, which significantly contributed to the increase in the call abandonment rate. A major factor behind this spike is the transition to the new iDesk system, which also included migrating the call center system.",
    "ActionPlan": "The call answer time has been increased from 3 seconds to 10 seconds to give agents sufficient time to respond to incoming calls. Additionally, the new system will be in place, with several enhancements  to further improve performance and efficiency."
  },
  {
    "KRIID": "KRI-023",
    "KRIName": "Delay in compliant closure",
    "Period": "2025-Q2",
    "ActualValue": "Count of delayed closure complaints : 73\r\nCount of total closed complaints) *: 625 =11.68%",
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "In the last quarter, we transitioned from the Odoo  to the new iDesk platform. While this shift led to some delays in complaint resolution, it was a necessary step to improve system performance, streamline internal workflows, unify all customer service channels under a single platform, and ultimately enhance service efficiency.",
    "ActionPlan": "The new system will be in place as we are waiting IA approval for iDesk and we’re already seeing positive results. Enhancements are still ongoing, and we expect a significant improvement in overall performance, along with faster complaint resolution across all service channels."
  },
  {
    "KRIID": "KRI-024",
    "KRIName": "Delay in compliant closure - Insurance Authority",
    "Period": "2025-Q2",
    "ActualValue": "Count of delayed closure complaints of Insurance Authority complaints :72 Count of total IA closed complaints) *: 476 =15.13%",
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "The spike in delayed IA complaints last quarter was mainly due to the IA team’s transition to a new system. This shift caused delays in complaint resolution, driven by multiple factors—most notably, system crashes, agent access issues, and the need for IA to manually create usernames and passwords for all complaint handlers.\r\nAlso, the claims backlog of Q1 impacted on complaint resolution as some of complaint been closed in Q2.",
    "ActionPlan": "The issue was raised with the IA team, and after several back-and-forth meetings, it has been resolved. The IA portal is now stable and fully operational."
  },
  {
    "KRIID": "KRI-025",
    "KRIName": "Compliant closure",
    "Period": "2025-Q2",
    "ActualValue": "1 delayed complaints Internal of total : 149 = 0.67 %",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-026",
    "KRIName": "Unsatisfactory CSAT score",
    "Period": "2025-Q2",
    "ActualValue": "ticket  CSAT - 60,11%",
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "",
    "ActionPlan": "total to be shared by fatama"
  },
  {
    "KRIID": "KRI-021",
    "KRIName": "Low First Call Resolution",
    "Period": "2026-Q1",
    "ActualValue": "(Number of First Call Resolutions / : 13496\r\nTotal Number of Inbound Calls attended) : 18856 =71.57%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-022",
    "KRIName": "High Abandon calls",
    "Period": "2026-Q1",
    "ActualValue": "(Number of Abandon calls : 365 \r\nTotal Number of Inbound Calls) : 18856= 1.93%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-023",
    "KRIName": "Delay in compliant closure",
    "Period": "2026-Q1",
    "ActualValue": "Count of delayed closure complaints : 8\r\nCount of total closed complaints) *: 951 =0.84%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-024",
    "KRIName": "Delay in compliant closure - Insurance Authority",
    "Period": "2026-Q1",
    "ActualValue": "Count of delayed closure complaints of Insurance Authority complaints :8 Count of total IA closed complaints) *100: 548 =1.45%",
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "The issue is due to technical errors, including delays in policy issuance and delays in linking medical policies. This is primarily caused by the lack of verification of the member count prior to policy issuance.",
    "ActionPlan": "A daily report is received from the Technical Department highlighting unissued policies and the related reasons for follow-up. In addition, access to Tawuniya’s admin policy system has been requested to avoid delays and allow direct handling without depending on Tawuniya. The request has been approved, and access is currently in progress."
  },
  {
    "KRIID": "KRI-025",
    "KRIName": "Compliant closure",
    "Period": "2026-Q1",
    "ActualValue": "0 delayed Internal complaints of total : 403 *100 = 0 %",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-021",
    "KRIName": "Low First Call Resolution",
    "Period": "2025-Q1",
    "ActualValue": "(Number of First Call Resolutions / : 8095\r\nTotal Number of Inbound Calls attended) : 11517 =79.20%",
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-022",
    "KRIName": "High Abandon calls",
    "Period": "2025-Q1",
    "ActualValue": "(Number of Abandon calls : 112 \r\nTotal Number of Inbound Calls) : 11517= 0.97%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-023",
    "KRIName": "Delay in compliant closure",
    "Period": "2025-Q1",
    "ActualValue": "Count of delayed closure complaints : 16\r\nCount of total closed complaints) *: 189 =8.47%",
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-024",
    "KRIName": "Delay in compliant closure - Insurance Authority",
    "Period": "2025-Q1",
    "ActualValue": "Count of delayed closure complaints of Insurance Authority complaints :5",
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "The main reason for the complaint delays is the backlog in claim settlements. This is primarily due to technical issues where some of settled claims are not reflected in the ERP system, requiring reprocessing. Additionally, the absence of notifications for delayed claims contributes to further delays in complaint closure",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-025",
    "KRIName": "Compliant closure",
    "Period": "2025-Q1",
    "ActualValue": "21 delayed complaints in IA & Internal of total :753",
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-026",
    "KRIName": "Unsatisfactory CSAT score",
    "Period": "2025-Q1",
    "ActualValue": 75,
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-021",
    "KRIName": "Low First Call Resolution",
    "Period": "2025-Q3",
    "ActualValue": "(Number of First Call Resolutions / : 11489\r\nTotal Number of Inbound Calls attended) : 15776 =72.83%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-022",
    "KRIName": "High Abandon calls",
    "Period": "2025-Q3",
    "ActualValue": "(Number of Abandon calls : 610 \r\nTotal Number of Inbound Calls) : 15776= 3.86%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-023",
    "KRIName": "Delay in compliant closure",
    "Period": "2025-Q3",
    "ActualValue": "Count of delayed closure complaints : 20\r\nCount of total closed complaints) *: 843 =2.37%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-024",
    "KRIName": "Delay in compliant closure - Insurance Authority",
    "Period": "2025-Q3",
    "ActualValue": "Count of delayed closure complaints of Insurance Authority complaints :3 Count of total IA closed complaints) *: 643 =0.46%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-025",
    "KRIName": "Compliant closure",
    "Period": "2025-Q3",
    "ActualValue": "3 delayed Internal complaints of total : 217 = 1.38 %",
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "The delay in complaint closure was primarily due to the transition to the new iDesk system, which caused temporary disruptions in processing and resolution timelines.",
    "ActionPlan": "we are currently working on enhancing and improving the new system, and the development is expected to be completed by the end of December."
  },
  {
    "KRIID": "KRI-021",
    "KRIName": "Low First Call Resolution",
    "Period": "2025-Q4",
    "ActualValue": "(Number of First Call Resolutions / : 15841\r\nTotal Number of Inbound Calls attended) : 18407 =86.05%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-022",
    "KRIName": "High Abandon calls",
    "Period": "2025-Q4",
    "ActualValue": "(Number of Abandon calls : 753 \r\nTotal Number of Inbound Calls) : 18407= 4.09%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-023",
    "KRIName": "Delay in compliant closure",
    "Period": "2025-Q4",
    "ActualValue": "Count of delayed closure complaints : 35\r\nCount of total closed complaints) *: 821 =4.85%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "The increase in delayed cases was mainly impacted by a technical issue related to medical insurance policies. This issue affected the processing and closure of internal complaints.\r\nAs a result of this technical problem, some complaints were not closed within the regulatory timeline of 5 days, leading to a temporary increase in the delay figures.",
    "ActionPlan": "The root cause of the issue was identified during the quotation process, where customers were provided with quotations without verifying the base number with CHI.\r\n\r\nAdditionally, a technical issue was identified in domestic workers’ medical insurance, which caused policies not to be issued due to a system error.\r\n\r\nAnother technical issue was also identified in domestic workers’ contract insurance, where cancellations could not be processed manually. As a corrective action, an automation solution was implemented to process cancellations directly through the Musaned platform.\r\n\r\nAll identified issues were addressed, and the necessary fixes were implemented by the end of December, to ensure smoother processing and prevent recurrence."
  },
  {
    "KRIID": "KRI-024",
    "KRIName": "Delay in compliant closure - Insurance Authority",
    "Period": "2025-Q4",
    "ActualValue": "Count of delayed closure complaints of Insurance Authority complaints :8 Count of total IA closed complaints) *100: 635 =1.25%",
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "The increase in delayed cases was mainly impacted by a technical issue related to medical insurance policies. This issue affected the processing and closure of internal complaints.\r\nAs a result of this technical problem, some complaints were not closed within the regulatory timeline of 5 days, leading to a temporary increase in the delay figures.",
    "ActionPlan": "The root cause of the issue was identified during the quotation process, where customers were provided with quotations without verifying the base number with CHI.\r\n\r\nAdditionally, a technical issue was identified in domestic workers’ medical insurance, which caused policies not to be issued due to a system error.\r\n\r\nAnother technical issue was also identified in domestic workers’ contract insurance, where cancellations could not be processed manually. As a corrective action, an automation solution was implemented to process cancellations directly through the Musaned platform.\r\n\r\nAll identified issues were addressed, and the necessary fixes were implemented by the end of December, to ensure smoother processing and prevent recurrence."
  },
  {
    "KRIID": "KRI-025",
    "KRIName": "Compliant closure",
    "Period": "2025-Q4",
    "ActualValue": "9 delayed Internal complaints of total : 186 *100 = 4.83 %",
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "The delay was mainly caused by technical issues related to medical insurance policies, including domestic workers’ medical insurance, where policies were not issued due to system errors.\r\n\r\nIn addition, a technical issue was identified in domestic workers’ contract insurance, where policy cancellations could not be processed as required. This resulted in delays in complaint closure.\r\n\r\nThese issues are internal system-related matters and differ from complaints registered with the Authority. The combined impact of these technical challenges led to an increase in the number of complaints not closed within the regulatory timeline of 5 days.",
    "ActionPlan": "The root cause of the issue was identified during the quotation process, where customers were provided with quotations without verifying the base number with CHI.\r\n\r\nAdditionally, a technical issue was identified in domestic workers’ medical insurance, which caused policies not to be issued due to a system error.\r\n\r\nAnother technical issue was also identified in domestic workers’ contract insurance, where cancellations could not be processed manually. As a corrective action, an automation solution was implemented to process cancellations directly through the Musaned platform.\r\n\r\nAll identified issues were addressed, and the necessary fixes were implemented by the end of December, to ensure smoother processing and prevent recurrence."
  },
  {
    "KRIID": "KRI-026",
    "KRIName": "Unsatisfactory CSAT score",
    "Period": "2026-Q1",
    "ActualValue": "Q1: 86.8%",
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "Sales Survey only\r\n Products : Motor, Medical malpractice, SMEH & Domestic worker contract / \r\n\r\nPlease note that the target is set for the year, and we are actively working on increasing CSAT to meet or exceed this target.",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-027",
    "KRIName": "NPS Composite",
    "Period": "2026-Q1",
    "ActualValue": "Q1: 65.2",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Sales Survey only\r\n Products : Motor, Medical malpractice, SMEH & Domestic worker contract / \r\n\r\nPlease note that the target is set for the year, and we are actively working on increasing NPS to meet or exceed this target.",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-028",
    "KRIName": "CES Score",
    "Period": "2026-Q1",
    "ActualValue": "Q1: 3.5%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Sales Survey only\r\n Products : Motor, Medical malpractice, SMEH & Domestic worker contract / \r\n\r\nPlease note that the target is set for the year, and we are actively working on increasing CES to meet or exceed this target.",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-026",
    "KRIName": "Unsatisfactory CSAT score",
    "Period": "2025-Q3",
    "ActualValue": "Q3 : 85.4",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Sales Survey only\r\n Products : Motor & Medical malpractice",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-027",
    "KRIName": "NPS Composite",
    "Period": "2025-Q3",
    "ActualValue": "Q3 : 58.7",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Sales Survey only\r\n Products : Motor & Medical malpractice",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-028",
    "KRIName": "CES Score",
    "Period": "2025-Q3",
    "ActualValue": "Q3: 4.9",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Sales Survey only\r\n Products : Motor & Medical malpractice",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-026",
    "KRIName": "Unsatisfactory CSAT score",
    "Period": "2025-Q4",
    "ActualValue": "Q4: 87.5%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Sales Survey only\r\n Products : Motor & Medical malpractice",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-027",
    "KRIName": "NPS Composite",
    "Period": "2025-Q4",
    "ActualValue": "Q4: 61.5",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Sales Survey only\r\n Products : Motor & Medical malpractice",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-028",
    "KRIName": "CES Score",
    "Period": "2025-Q4",
    "ActualValue": "Q4: 3.6",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Sales Survey only\r\n Products : Motor & Medical malpractice",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-029",
    "KRIName": "Cyber security incidents",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "The Security Operations Center (SOC) has been activated on Tree's infrastructure. Currently, no security incidents have been reported.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-030",
    "KRIName": "Data leak incidents",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "The Security Operations Center (SOC) has been activated on Tree's infrastructure. Currently, no data leakage incidents have occurred.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-031",
    "KRIName": "Critical systems or customer facing systems were unavailable for carrying out BAU activities due to Cyber Security issues like virus/ ransomware/ hacking/phishing attacks",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "The Security Operations Center (SOC) has been activated on Tree's infrastructure. Currently, there have been no instances of unavailability.and \"so far, there have been no service disruptions.\"",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-032",
    "KRIName": "Vulnerability Scanning",
    "Period": "2025-Q3",
    "ActualValue": 3,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "Currently, we have a vulnerability scanning solution (Qualys) in place. We are able to establish a vulnerability management program and have visibility into the metrics needed to report on this KRI.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-033",
    "KRIName": "Open/outstanding identified High risk vulnerabilities with the aging of more than 1 month",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "In progress",
    "Justification": "We are currently working to close the findings from the vulnerability scan. Now, we have established the vulnerability management program and have visibility into the metrics needed to report on this KRI.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-034",
    "KRIName": "Conducting PEN testing",
    "Period": "2025-Q3",
    "ActualValue": 4,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-035",
    "KRIName": "DDOS Protection sloution",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "DDoS protection has been implemented in the OCI environment.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-036",
    "KRIName": "Critical systems unavailable due to Cyber attack",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "-",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-029",
    "KRIName": "Cyber security incidents",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "The Security Operations Center (SOC) has been activated on Tree's infrastructure. Currently, no security incidents have been reported.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-030",
    "KRIName": "Data leak incidents",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "The Security Operations Center (SOC) has been activated on Tree's infrastructure. Currently, no data leakage incidents have occurred.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-031",
    "KRIName": "Critical systems or customer facing systems were unavailable for carrying out BAU activities due to Cyber Security issues like virus/ ransomware/ hacking/phishing attacks",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "The Security Operations Center (SOC) has been activated on Tree's infrastructure. Currently, there have been no instances of unavailability.and \"so far, there have been no service disruptions.\"",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-032",
    "KRIName": "Vulnerability Scanning",
    "Period": "2025-Q4",
    "ActualValue": 3,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "Currently, we have a vulnerability scanning solution (Qualys) in place. We are able to establish a vulnerability management program and have visibility into the metrics needed to report on this KRI.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-033",
    "KRIName": "Open/outstanding identified High risk vulnerabilities with the aging of more than 1 month",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "In progress",
    "Justification": "We are continuously addressing findings from vulnerability scans as part of an ongoing process. Our established Vulnerability Management Program provides continuous visibility into vulnerabilities and the metrics required for KRI reporting, ensuring that remediation is performed whenever new vulnerabilities are identified.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-034",
    "KRIName": "Conducting PEN testing",
    "Period": "2025-Q4",
    "ActualValue": 4,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-035",
    "KRIName": "DDOS Protection sloution",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "DDoS protection has been implemented in the OCI environment.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-036",
    "KRIName": "Critical systems unavailable due to Cyber attack",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "-",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-029",
    "KRIName": "Cyber security incidents",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "The Security Operations Center (SOC) has been activated on Tree's infrastructure. Currently, no security incidents have been reported.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-030",
    "KRIName": "Data leak incidents",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "The Security Operations Center (SOC) has been activated on Tree's infrastructure. Currently, no data leakage incidents have occurred.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-031",
    "KRIName": "Critical systems or customer facing systems were unavailable for carrying out BAU activities due to Cyber Security issues like virus/ ransomware/ hacking/phishing attacks",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "The Security Operations Center (SOC) has been activated on Tree's infrastructure. Currently, there have been no instances of unavailability.and \"so far, there have been no service disruptions.\"",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-032",
    "KRIName": "Vulnerability Scanning",
    "Period": "2026-Q1",
    "ActualValue": 8,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "Currently, we have a vulnerability scanning solution (Qualys) in place. We are able to establish a vulnerability management program and have visibility into the metrics needed to report on this KRI.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-033",
    "KRIName": "Open/outstanding identified High risk vulnerabilities with the aging of more than 1 month",
    "Period": "2026-Q1",
    "ActualValue": 60,
    "RAGStatus": "Green",
    "Comments": "In progress",
    "Justification": "We have identified all vulnerabilities, and the identified vulnerabilities will be closed in Q2 2026",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-034",
    "KRIName": "Conducting PEN testing",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "The Penetration Test is not quarrtly based and it will be conducted in Q2 2026.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-035",
    "KRIName": "DDOS Protection sloution",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "DDoS protection has been implemented in the OCI environment.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-036",
    "KRIName": "Critical systems unavailable due to Cyber attack",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "We have an active SIEM solution in place to effectively detect and identify potential security attacks.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-029",
    "KRIName": "Cyber security incidents",
    "Period": "2025-Q1",
    "ActualValue": "No data available",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "The Security Operation Center (SOC) is not activiated on Tree's infrastructure. Currently, we are working to ensure the full coverage on all Tree's Information Assets",
    "ActionPlan": "To work with the Vendor (Security Matterz) and Technology department and ensure the full coverage of Tree's Information Assets to activiate the SOC."
  },
  {
    "KRIID": "KRI-030",
    "KRIName": "Data leak incidents",
    "Period": "2025-Q1",
    "ActualValue": "No data available",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "The Security Operation Center (SOC) is not activiated on Tree's infrastructure. Currently, we are working to ensure the full coverage on all Tree's Information Assets",
    "ActionPlan": "To work with the Vendor (Security Matterz) and Technology department and ensure the full coverage of Tree's Information Assets to activiate the SOC."
  },
  {
    "KRIID": "KRI-031",
    "KRIName": "Critical systems or customer facing systems were unavailable for carrying out BAU activities due to Cyber Security issues like virus/ ransomware/ hacking/phishing attacks",
    "Period": "2025-Q1",
    "ActualValue": "No data available",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "The Security Operation Center (SOC) is not activiated on Tree's infrastructure. Currently, we are working to ensure the full coverage on all Tree's Information Assets",
    "ActionPlan": "To work with the Vendor (Security Matterz) and Technology department and ensure the full coverage of Tree's Information Assets to activiate the SOC."
  },
  {
    "KRIID": "KRI-032",
    "KRIName": "Vulnerability Scanning",
    "Period": "2025-Q1",
    "ActualValue": "No data available",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "Currently we are working on acquiring vulnerability scan solution. After, having the solution we will be able to establsih the vulnerability program and have vsiability on the metrics to reprot for this KRI.",
    "ActionPlan": "Acquire an implement vulnerability management solution and start performing vulnerability assessments"
  },
  {
    "KRIID": "KRI-033",
    "KRIName": "Open/outstanding identified High risk vulnerabilities with the aging of more than 1 month",
    "Period": "2025-Q1",
    "ActualValue": "No data available",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "Currently we are working on acquiring vulnerability scan solution. After, having the solution we will be able to establsih the vulnerability program and have vsiability on the metrics to reprot for this KRI.",
    "ActionPlan": "Acquire an implement vulnerability management solution and start performing vulnerability assessments"
  },
  {
    "KRIID": "KRI-034",
    "KRIName": "Conducting PEN testing",
    "Period": "2025-Q1",
    "ActualValue": 2,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-029",
    "KRIName": "Cyber security incidents",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "The Security Operations Center (SOC) has been activated on Tree's infrastructure. Currently, no security incidents have been reported.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-030",
    "KRIName": "Data leak incidents",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "The Security Operations Center (SOC) has been activated on Tree's infrastructure. Currently, no data leakage incidents have occurred.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-031",
    "KRIName": "Critical systems or customer facing systems were unavailable for carrying out BAU activities due to Cyber Security issues like virus/ ransomware/ hacking/phishing attacks",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "The Security Operations Center (SOC) has been activated on Tree's infrastructure. Currently, there have been no instances of unavailability.and \"so far, there have been no service disruptions.\"",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-032",
    "KRIName": "Vulnerability Scanning",
    "Period": "2025-Q2",
    "ActualValue": 5,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "Currently, we have a vulnerability scanning solution (Qualys) in place. We are able to establish a vulnerability management program and have visibility into the metrics needed to report on this KRI.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-033",
    "KRIName": "Open/outstanding identified High risk vulnerabilities with the aging of more than 1 month",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "We are currently working to close the findings from the vulnerability scan. Now, we have established the vulnerability management program and have visibility into the metrics needed to report on this KRI.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-034",
    "KRIName": "Conducting PEN testing",
    "Period": "2025-Q2",
    "ActualValue": 1,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-035",
    "KRIName": "DDOS Protection sloution",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "DDoS protection has been implemented in the OCI environment.",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-036",
    "KRIName": "Critical systems unavailable due to Cyber attack",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "Done",
    "Justification": "-",
    "ActionPlan": "N/A"
  },
  {
    "KRIID": "KRI-037",
    "KRIName": "Zero tolerance on appointing Partners without approval",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-038",
    "KRIName": "Due diligence not performed on partners before starting the partnership",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-039",
    "KRIName": "Delays in Project completion of products",
    "Period": "2026-Q1",
    "ActualValue": 7,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Dependency on TW APIs",
    "ActionPlan": "Initiate API request from TW before starting the development from Tree end."
  },
  {
    "KRIID": "KRI-040",
    "KRIName": "Approvals were not obtained for UI and UX changes or implementation",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-041",
    "KRIName": "Absence of sign offs on the product testings",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-042",
    "KRIName": "Non compliance with regulatory requirements with respect to Product",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-037",
    "KRIName": "Zero tolerance on appointing Partners without approval",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-038",
    "KRIName": "Due diligence not performed on partners before starting the partnership",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-039",
    "KRIName": "Delays in Project completion of products",
    "Period": "2025-Q1",
    "ActualValue": 10,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Dependency on TW APIs",
    "ActionPlan": "Initiate API request from TW before starting the development from Tree end."
  },
  {
    "KRIID": "KRI-040",
    "KRIName": "Approvals were not obtained for UI and UX changes or implementation",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-041",
    "KRIName": "Absence of sign offs on the product testings",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-042",
    "KRIName": "Non compliance with regulatory requirements with respect to Product",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-037",
    "KRIName": "Zero tolerance on appointing Partners without approval",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-038",
    "KRIName": "Due diligence not performed on partners before starting the partnership",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-039",
    "KRIName": "Delays in Project completion of products",
    "Period": "2025-Q2",
    "ActualValue": 5,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Dependency on TW APIs",
    "ActionPlan": "Initiate API request from TW before starting the development from Tree end."
  },
  {
    "KRIID": "KRI-040",
    "KRIName": "Approvals were not obtained for UI and UX changes or implementation",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-041",
    "KRIName": "Absence of sign offs on the product testings",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-042",
    "KRIName": "Non compliance with regulatory requirements with respect to Product",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-037",
    "KRIName": "Zero tolerance on appointing Partners without approval",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-038",
    "KRIName": "Due diligence not performed on partners before starting the partnership",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-039",
    "KRIName": "Delays in Project completion of products",
    "Period": "2025-Q3",
    "ActualValue": 5,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Dependency on TW APIs",
    "ActionPlan": "Initiate API request from TW before starting the development from Tree end."
  },
  {
    "KRIID": "KRI-040",
    "KRIName": "Approvals were not obtained for UI and UX changes or implementation",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-041",
    "KRIName": "Absence of sign offs on the product testings",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-042",
    "KRIName": "Non compliance with regulatory requirements with respect to Product",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-037",
    "KRIName": "Zero tolerance on appointing Partners without approval",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-038",
    "KRIName": "Due diligence not performed on partners before starting the partnership",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-039",
    "KRIName": "Delays in Project completion of products",
    "Period": "2025-Q4",
    "ActualValue": 3,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Dependency on TW APIs",
    "ActionPlan": "Initiate API request from TW before starting the development from Tree end."
  },
  {
    "KRIID": "KRI-040",
    "KRIName": "Approvals were not obtained for UI and UX changes or implementation",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-041",
    "KRIName": "Absence of sign offs on the product testings",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-042",
    "KRIName": "Non compliance with regulatory requirements with respect to Product",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-043",
    "KRIName": "Fraudulent attempts to initiate unauthorized payments",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-047",
    "KRIName": "Long pending open items in Bank Reconciliation",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-048",
    "KRIName": "Deviation from annual Procurement Plan",
    "Period": "2025-Q2",
    "ActualValue": 28,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Actual Number is less than Budget amount in 28%",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-049",
    "KRIName": "General and Administration (G&A) expenses",
    "Period": "2025-Q2",
    "ActualValue": 1.8,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Spending lower than Budget",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-050",
    "KRIName": "Profit and Loss",
    "Period": "2025-Q2",
    "ActualValue": "N/A",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "Profit after Zakat wasn't on budget",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-051",
    "KRIName": "Inadequate Liquidity Management",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-052",
    "KRIName": "Capex",
    "Period": "2025-Q2",
    "ActualValue": "Below budget by 44%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-043",
    "KRIName": "Fraudulent attempts to initiate unauthorized payments",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-047",
    "KRIName": "Long pending open items in Bank Reconciliation",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-048",
    "KRIName": "Deviation from annual Procurement Plan",
    "Period": "2026-Q1",
    "ActualValue": 90.3,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Actual Number is less than Budget amount in 9.7%",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-049",
    "KRIName": "General and Administration (G&A) expenses",
    "Period": "2026-Q1",
    "ActualValue": 1.1245,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "Spending Above than Budget by 12.45% for Q4 only, full year spending within the budget Actual : 64,144,198.57 , Budget : 64,433,815\r\nThe increase in Q4 2025 is due to the move to the new building and business needs",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-050",
    "KRIName": "Profit and Loss",
    "Period": "2026-Q1",
    "ActualValue": "N/A",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "Profit after Zakat wasn't on budget",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-051",
    "KRIName": "Inadequate Liquidity Management",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-052",
    "KRIName": "Capex",
    "Period": "2026-Q1",
    "ActualValue": 1.3885,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "Actual Number is Above than Budget amount by 38.85% for Q4 only, full year spending within the budget Actual : 19,558,909 , Budget : 25,316,664 \r\nThe increase in Q4 2025 is due to the move to the new building and business needs",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-043",
    "KRIName": "Fraudulent attempts to initiate unauthorized payments",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-047",
    "KRIName": "Long pending open items in Bank Reconciliation",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-048",
    "KRIName": "Deviation from annual Procurement Plan",
    "Period": "2025-Q1",
    "ActualValue": 10,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "Actual Number is less than Budget amount in 10%",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-049",
    "KRIName": "General and Administration (G&A) expenses",
    "Period": "2025-Q1",
    "ActualValue": -0.017954401886488336,
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "Spending G&A is Slighthy more than Budget",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-050",
    "KRIName": "Profit and Loss",
    "Period": "2025-Q1",
    "ActualValue": "N/A",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "Profit after Zakat wasn't on budget",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-051",
    "KRIName": "Inadequate Liquidity Management",
    "Period": "2025-Q1",
    "ActualValue": 1,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "Delay in funding in the floating account from Taw.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-052",
    "KRIName": "Capex",
    "Period": "2025-Q1",
    "ActualValue": "Below budget by 83%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-043",
    "KRIName": "Fraudulent attempts to initiate unauthorized payments",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-047",
    "KRIName": "Long pending open items in Bank Reconciliation",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-048",
    "KRIName": "Deviation from annual Procurement Plan",
    "Period": "2025-Q3",
    "ActualValue": 10.8,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Actual Number is less than Budget amount in 10.8%",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-049",
    "KRIName": "General and Administration (G&A) expenses",
    "Period": "2025-Q3",
    "ActualValue": 16.84,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Spending lower than Budget",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-050",
    "KRIName": "Profit and Loss",
    "Period": "2025-Q3",
    "ActualValue": "N/A",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "Profit after Zakat wasn't on budget",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-051",
    "KRIName": "Inadequate Liquidity Management",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-052",
    "KRIName": "Capex",
    "Period": "2025-Q3",
    "ActualValue": "Below Budget By\r\n2.4%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Actual Number is less than Budget amount in 2.4%",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-043",
    "KRIName": "Fraudulent attempts to initiate unauthorized payments",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-047",
    "KRIName": "Long pending open items in Bank Reconciliation",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-048",
    "KRIName": "Deviation from annual Procurement Plan",
    "Period": "2025-Q4",
    "ActualValue": 90.3,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Actual Number is less than Budget amount in 9.7%",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-049",
    "KRIName": "General and Administration (G&A) expenses",
    "Period": "2025-Q4",
    "ActualValue": 1.1245,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "Spending Above than Budget by 12.45% for Q4 only, full year spending within the budget Actual : 64,144,198.57 , Budget : 64,433,815\r\nThe increase in Q4 2025 is due to the move to the new building and business needs",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-050",
    "KRIName": "Profit and Loss",
    "Period": "2025-Q4",
    "ActualValue": "N/A",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "Profit after Zakat wasn't on budget",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-051",
    "KRIName": "Inadequate Liquidity Management",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-052",
    "KRIName": "Capex",
    "Period": "2025-Q4",
    "ActualValue": 1.3885,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "Actual Number is Above than Budget amount by 38.85% for Q4 only, full year spending within the budget Actual : 19,558,909 , Budget : 25,316,664 \r\nThe increase in Q4 2025 is due to the move to the new building and business needs",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-053",
    "KRIName": "Fraudulent Procurement Activities",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-054",
    "KRIName": "Purchase Requisition Cycle Time",
    "Period": "2025-Q1",
    "ActualValue": "Not Assessed as no data available",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-055",
    "KRIName": "Empanelment of Vendor without approval",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-053",
    "KRIName": "Fraudulent Procurement Activities",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-054",
    "KRIName": "Purchase Requisition Cycle Time",
    "Period": "2025-Q2",
    "ActualValue": "Not Assessed as no data available",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-055",
    "KRIName": "Empanelment of Vendor without approval",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-053",
    "KRIName": "Fraudulent Procurement Activities",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-054",
    "KRIName": "Purchase Requisition Cycle Time",
    "Period": "2025-Q3",
    "ActualValue": 20,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "The numbers of days updated as per the Procurement SOP",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-055",
    "KRIName": "Empanelment of Vendor without approval",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-053",
    "KRIName": "Fraudulent Procurement Activities",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-054",
    "KRIName": "Purchase Requisition Cycle Time",
    "Period": "2025-Q4",
    "ActualValue": 21,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "The numbers of days updated as per the Procurement SOP",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-055",
    "KRIName": "Empanelment of Vendor without approval",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-056",
    "KRIName": "High employee turnover",
    "Period": "2025-Q2",
    "ActualValue": 17,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-057",
    "KRIName": "Percentage of breach of code of conduct",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-061",
    "KRIName": "Non-compliance with Saudization requirements",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-062",
    "KRIName": "Background checks on new hires",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-063",
    "KRIName": "Instances of incorrect/duplicate/fraud payroll transactions",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-064",
    "KRIName": "Budget violation - Manpower plan exceeds the limits mentioned in the budget",
    "Period": "2025-Q2",
    "ActualValue": 89,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "number is estimated as Mid year closing under process",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-065",
    "KRIName": "Delay in Full and final settlement",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-066",
    "KRIName": "Non compliance in maintaining essential government licences",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-067",
    "KRIName": "Employee Engagement Score",
    "Period": "2025-Q2",
    "ActualValue": "-",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "Employee engegement survey score will be conducted by end of year",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-068",
    "KRIName": "Vacant Key Position",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-056",
    "KRIName": "High employee turnover",
    "Period": "2026-Q1",
    "ActualValue": 25,
    "RAGStatus": "Green",
    "Comments": "Left Employee 24\r\nAvg Employee 96",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-057",
    "KRIName": "Percentage of breach of code of conduct",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "No Reporting",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2026-Q1",
    "ActualValue": 1,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Employees have been scheduled to take the test at the earliest available date. For the one pending employee, we are following up with the department to finalize the schedule. As per CHRO feedback, The employee has been granted an approval to take the exam in Q2 this year therefore the risk is mitigated and accordingly I request the classification to be green.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-061",
    "KRIName": "Non-compliance with Saudization requirements",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-062",
    "KRIName": "Background checks on new hires",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "All new hires background checks have been performed via AMAN",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-063",
    "KRIName": "Instances of incorrect/duplicate/fraud payroll transactions",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-064",
    "KRIName": "Budget violation - Manpower plan exceeds the limits mentioned in the budget",
    "Period": "2026-Q1",
    "ActualValue": 94,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-065",
    "KRIName": "Delay in Full and final settlement",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-066",
    "KRIName": "Non compliance in maintaining essential government licences",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-067",
    "KRIName": "Employee Engagement Score",
    "Period": "2026-Q1",
    "ActualValue": "N/A",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "Employee engegement survey score will be conducted by end of year",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-068",
    "KRIName": "Vacant Key Position",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-056",
    "KRIName": "High employee turnover",
    "Period": "2025-Q1",
    "ActualValue": 2.53,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-057",
    "KRIName": "Percentage of breach of code of conduct",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2025-Q1",
    "ActualValue": 18,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "All employees who joined in Q1-2025 completed the mandatory (AML and Anti fraud) trainings",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2025-Q1",
    "ActualValue": 7,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "The plan was to conduct the training during the 6 months of joining and due to the change rules from management, we scheduled the employees to take the test on Q2-2025 which was the earliest avalibilities",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-061",
    "KRIName": "Non-compliance with Saudization requirements",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-062",
    "KRIName": "Background checks on new hires",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-063",
    "KRIName": "Instances of incorrect/duplicate/fraud payroll transactions",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-064",
    "KRIName": "Budget violation - Manpower plan exceeds the limits mentioned in the budget",
    "Period": "2025-Q1",
    "ActualValue": 76,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-065",
    "KRIName": "Delay in Full and final settlement",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-066",
    "KRIName": "Non compliance in maintaining essential government licences",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-067",
    "KRIName": "Employee Engagement Score",
    "Period": "2025-Q1",
    "ActualValue": "-",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "Employee engegement survey score will be conducted by end of year",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-068",
    "KRIName": "Vacant Key Position",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-056",
    "KRIName": "High employee turnover",
    "Period": "2025-Q3",
    "ActualValue": 25,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-057",
    "KRIName": "Percentage of breach of code of conduct",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-061",
    "KRIName": "Non-compliance with Saudization requirements",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-062",
    "KRIName": "Background checks on new hires",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-063",
    "KRIName": "Instances of incorrect/duplicate/fraud payroll transactions",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-064",
    "KRIName": "Budget violation - Manpower plan exceeds the limits mentioned in the budget",
    "Period": "2025-Q3",
    "ActualValue": 67,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-065",
    "KRIName": "Delay in Full and final settlement",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-066",
    "KRIName": "Non compliance in maintaining essential government licences",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-067",
    "KRIName": "Employee Engagement Score",
    "Period": "2025-Q3",
    "ActualValue": "NA",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "Employee engegement survey score will be conducted by end of year",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-068",
    "KRIName": "Vacant Key Position",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-056",
    "KRIName": "High employee turnover",
    "Period": "2025-Q4",
    "ActualValue": 25,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-057",
    "KRIName": "Percentage of breach of code of conduct",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-060",
    "KRIName": "Completion of regulatory training by employees",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-061",
    "KRIName": "Non-compliance with Saudization requirements",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-062",
    "KRIName": "Background checks on new hires",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-063",
    "KRIName": "Instances of incorrect/duplicate/fraud payroll transactions",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-064",
    "KRIName": "Budget violation - Manpower plan exceeds the limits mentioned in the budget",
    "Period": "2025-Q4",
    "ActualValue": 92,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-065",
    "KRIName": "Delay in Full and final settlement",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-066",
    "KRIName": "Non compliance in maintaining essential government licences",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-067",
    "KRIName": "Employee Engagement Score",
    "Period": "2025-Q4",
    "ActualValue": 91,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Employee engegement survey score will be conducted by end of year",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-068",
    "KRIName": "Vacant Key Position",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-069",
    "KRIName": "Delay in patch deployment",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "To provide the patch activity logs for this",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-070",
    "KRIName": "Devices with no/ latest antivirus software",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Get report or screenshot to prove this",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-071",
    "KRIName": "Changes promoted to production without due approval",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "This process will always continue because of our fastracked process for emergency deployments; however; all changes are ultimately logged and approved. Provide a screenshot of the CR workflow",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-072",
    "KRIName": "Access right revocation",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Provide the email evidence to show this lifecycle. Aswell as the AD enviroment where these people are removed",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-073",
    "KRIName": "Delay in incident resolution",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Our uptime has been consistently notth of 99%",
    "ActionPlan": "Network Operations Centre is due to be established. They will handle Incidents and formalize the categorization. The IT SLAs are being drafted and will be adopted shortly"
  },
  {
    "KRIID": "KRI-074",
    "KRIName": "Downtime of core system",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Provide evidence of the downtime",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-075",
    "KRIName": "Delays in project completion",
    "Period": "2025-Q2",
    "ActualValue": 10,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Delays due to Tree (without a dependancy) stand at 10%",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-076",
    "KRIName": "Go-Live Approval",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "This is related to Demand & Delivery due to project management (mohammed Said)",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-069",
    "KRIName": "Delay in patch deployment",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "To provide the patch activity logs for this",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-070",
    "KRIName": "Devices with no/ latest antivirus software",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Get report or screenshot to prove this",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-071",
    "KRIName": "Changes promoted to production without due approval",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "This process will always continue because of our fastracked process for emergency deployments; however; all changes are ultimately logged and approved. Provide a screenshot of the CR workflow",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-072",
    "KRIName": "Access right revocation",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Provide the email evidence to show this lifecycle. Aswell as the AD enviroment where these people are removed",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-073",
    "KRIName": "Delay in incident resolution",
    "Period": "2025-Q1",
    "ActualValue": 1,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Our uptime has been consistently notth of 99%",
    "ActionPlan": "Network Operations Centre is due to be established. They will handle Incidents and formalize the categorization. The IT SLAs are being drafted and will be adopted shortly"
  },
  {
    "KRIID": "KRI-074",
    "KRIName": "Downtime of core system",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Provide evidence of the downtime",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-075",
    "KRIName": "Delays in project completion",
    "Period": "2025-Q1",
    "ActualValue": 10,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Delays due to Tree (without a dependancy) stand at 10%",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-076",
    "KRIName": "Go-Live Approval",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "This is related to Demand & Delivery due to project management (mohammed Said)",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-069",
    "KRIName": "Delay in patch deployment",
    "Period": "2026-Q1",
    "ActualValue": 16,
    "RAGStatus": "Green",
    "Comments": "The green threshold was changed to 20 to accommodate the planned failed patching of decommissioned servers",
    "Justification": "Tracking this has been impacted due to the implementation of the licence renewal, infrastructure migration and reamadan remote work. This skewed the view of patch effectiveness however, patching was still implemeted. We had 303 successful pacthes out of a total 449. Note that our Windows VMs are currently being decommissioned and no longer undergoing patching. These servers are being decommissioned as part of our strategy to enhance our security",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-070",
    "KRIName": "Devices with no/ latest antivirus software",
    "Period": "2026-Q1",
    "ActualValue": 10,
    "RAGStatus": "Green",
    "Comments": "The 10% is indicative due to the disruption on reporting",
    "Justification": "Anivirus effective on machines, however the central system faced some disruption due to the infrastrucutre migration. As a result there was some interruption on the reporting.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-071",
    "KRIName": "Changes promoted to production without due approval",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "We have a new \"Enhancement\" process that is now estalished. As part of this workflow, Change approval board (CAB) and approvals are required",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-072",
    "KRIName": "Access right revocation",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Well established self service portal available for this",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-073",
    "KRIName": "Delay in incident resolution",
    "Period": "2026-Q1",
    "ActualValue": 5,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "The vast majority of tickets are resolved within 24 hrs. We now have an established system for 1st line support with SLA tracking",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-074",
    "KRIName": "Downtime of core system",
    "Period": "2026-Q1",
    "ActualValue": 1,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-075",
    "KRIName": "Delays in project completion",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Delays due to Tree (without a dependancy) stand at 0%",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-076",
    "KRIName": "Go-Live Approval",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "This is related to Demand & Delivery due to project management (mohammed Said). There are no projects that went live wihtout approval",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-069",
    "KRIName": "Delay in patch deployment",
    "Period": "2025-Q3",
    "ActualValue": 4,
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "5 out of 117 failed patches. This is due to the device losing connectivity during installation. The system will automatically retry the installation when the device is back online",
    "ActionPlan": "This is normal. However, we will create a procedure to follow up on theses incase the failure is software related. We will also conduct an SLA on the cause"
  },
  {
    "KRIID": "KRI-070",
    "KRIName": "Devices with no/ latest antivirus software",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Get report or screenshot to prove this",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-071",
    "KRIName": "Changes promoted to production without due approval",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "This process will always continue because of our fastracked process for emergency deployments; however; all changes are ultimately logged and approved. Provide a screenshot of the CR workflow",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-072",
    "KRIName": "Access right revocation",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Provide the email evidence to show this lifecycle. Aswell as the AD enviroment where these people are removed",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-073",
    "KRIName": "Delay in incident resolution",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Our uptime has been consistently notth of 99%",
    "ActionPlan": "Network Operations Centre is due to be established. They will handle Incidents and formalize the categorization. The IT SLAs are being drafted and will be adopted shortly"
  },
  {
    "KRIID": "KRI-074",
    "KRIName": "Downtime of core system",
    "Period": "2025-Q3",
    "ActualValue": "<1%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Provide evidence of the downtime",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-075",
    "KRIName": "Delays in project completion",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Delays due to Tree (without a dependancy) stand at 0%",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-076",
    "KRIName": "Go-Live Approval",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "This is related to Demand & Delivery due to project management (mohammed Said)",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-069",
    "KRIName": "Delay in patch deployment",
    "Period": "2025-Q4",
    "ActualValue": 4,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "234 out of 244 successful patches. This is due to the device losing connectivity during installation. The system will automatically retry the installation when the device is back online",
    "ActionPlan": "This is normal. However, we will create a procedure to follow up on theses incase the failure is software related. We will also conduct an SLA on the cause"
  },
  {
    "KRIID": "KRI-070",
    "KRIName": "Devices with no/ latest antivirus software",
    "Period": "2025-Q4",
    "ActualValue": 7,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "18 out of 244 do not have antivirus installed due to netwrok connectivity",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-071",
    "KRIName": "Changes promoted to production without due approval",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "This process will always continue because of our fastracked process for emergency deployments; however; all changes are ultimately logged and approved. Provide a screenshot of the CR workflow",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-072",
    "KRIName": "Access right revocation",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Provide the email evidence to show this lifecycle. Aswell as the AD enviroment where these people are removed",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-073",
    "KRIName": "Delay in incident resolution",
    "Period": "2025-Q4",
    "ActualValue": 5,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "The vast majority of tickets are resolved within 24 hrs",
    "ActionPlan": "Network Operations Centre is due to be established. They will handle Incidents and formalize the categorization. The IT SLAs are being drafted and will be adopted shortly"
  },
  {
    "KRIID": "KRI-074",
    "KRIName": "Downtime of core system",
    "Period": "2025-Q4",
    "ActualValue": 1,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Provide evidence of the downtime",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-075",
    "KRIName": "Delays in project completion",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Delays due to Tree (without a dependancy) stand at 0%",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-076",
    "KRIName": "Go-Live Approval",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "This is related to Demand & Delivery due to project management (mohammed Said)",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-077",
    "KRIName": "Usage of marketing material uploaded without approval",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-078",
    "KRIName": "Decline in social media engagement from previous quarter (audience interaction)",
    "Period": "2025-Q1",
    "ActualValue": "Not assist",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "We have transitioned to a new system for providing social media insights. Unfortunately, we are currently facing an issue that prevents us from accessing Q1 data.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-079",
    "KRIName": "Negative sentiments",
    "Period": "2025-Q1",
    "ActualValue": "Not assist",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "We have transitioned to a new system for providing social media insights. Unfortunately, we are currently facing an issue that prevents us from accessing Q1 data.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-027",
    "KRIName": "NPS Composite",
    "Period": "2025-Q1",
    "ActualValue": 64.4,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-082",
    "KRIName": "Increase in Customer Acquisition Cost (CAC) from the budgeted cost",
    "Period": "2025-Q1",
    "ActualValue": "420 SAR (With awareness campaigns) 265%\r\n189 SAR (Without awareness campaigns) 132%",
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "Part of our Q1 plan was to heavily spend on awarenes, this will immediately increase our CAC on awareness which will eventually lead to a lower CAC in the future.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-081",
    "KRIName": "Policy Acquisition Cost (PAC)",
    "Period": "2025-Q1",
    "ActualValue": "206.4 SAR  179%",
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "Due to the Jan and Feb  performance our PAC was so High for Q1. In March our PAC is at 98% .",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-083",
    "KRIName": "Variation in marketing budget vs actual expense",
    "Period": "2025-Q1",
    "ActualValue": 72,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "In order to control our high cost we had to manage our spending in March",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-084",
    "KRIName": "Variation in Return on Ad Spend vs expected return",
    "Period": "2025-Q1",
    "ActualValue": 4.9,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "Jan and Feb were not fully expended due to campaigns pausing for pricing model changing, in addition to some technical issues",
    "ActionPlan": "In March, actions plan were taken to optimize our performance in terms of cost, number of sales, channels used"
  },
  {
    "KRIID": "KRI-085",
    "KRIName": "AD status (not more than 90 days)",
    "Period": "2025-Q1",
    "ActualValue": "30 days",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-077",
    "KRIName": "Usage of marketing material uploaded without approval",
    "Period": "2026-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Social media calendar is always shared with the Compliance team before publishing",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-078",
    "KRIName": "Decline in social media engagement from previous quarter (audience interaction)",
    "Period": "2026-Q1",
    "ActualValue": 3.9,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-079",
    "KRIName": "Negative sentiments",
    "Period": "2026-Q1",
    "ActualValue": 9,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-080",
    "KRIName": "Number of Growth Experiments",
    "Period": "2026-Q1",
    "ActualValue": "1) 3 Experiments were successful \r\n2) 2 were unsuccessful",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "In Q1 we ran 3 Experiments and all 3 were successfull\r\n1st Running traffic on social increased traffic and led higher number of  leads\r\n2nd Running multiple bid strategies on comprehensive motor increased sales and ROAS \r\n3rd. Running different style of assets on social as an A/b test led to better understanding of the market interest\r\n\r\nAlso, we ran 2 Experiments and they were unssuccessfull\r\n1st testing IH camapigns based on intent and behavior level was not successful \r\n2nd Targeting DWH policy holders for Home insurance product -- consented target was very small (30 users)",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-081",
    "KRIName": "Policy Acquisition Cost (PAC)",
    "Period": "2026-Q1",
    "ActualValue": 92,
    "RAGStatus": "Amber",
    "Comments": "As discussed, Marketing team suggested to change the threshold to the following\r\n >100%\r\n<=90% – >=100%\r\n<90%\r\nand change the equation to\r\n benchmark / Achived CAC",
    "Justification": "During Q1, we launched IH product and Brand campaign to build awareness in the market about the product and the brand itself which increased revenue and lowered our CAC.",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-083",
    "KRIName": "Variation in marketing budget vs actual expense",
    "Period": "2026-Q1",
    "ActualValue": 84,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Seasonality budget shuffle to follow the market behavior and trend",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-084",
    "KRIName": "Variation in Return on Ad Spend vs expected return",
    "Period": "2026-Q1",
    "ActualValue": 8.31,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "During Q1, we have focused on CO and IH and TPL to generate higher revenue by increasing sales at a lower cost.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-085",
    "KRIName": "AD status (not more than 90 days)",
    "Period": "2026-Q1",
    "ActualValue": "30 days",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-077",
    "KRIName": "Usage of marketing material uploaded without approval",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-078",
    "KRIName": "Decline in social media engagement from previous quarter (audience interaction)",
    "Period": "2025-Q2",
    "ActualValue": "Not Assessed",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Q2 data is available, however, the data for Q1 is not available due to lacking the SM tool in Q1",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-079",
    "KRIName": "Negative sentiments",
    "Period": "2025-Q2",
    "ActualValue": "Not Assessed",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "We currently don't have a platform to evaluate social media sentiment as there's no need for it since the brand is still small to have huge volume of comments/mentions in our social media accounts.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-027",
    "KRIName": "NPS Composite",
    "Period": "2025-Q2",
    "ActualValue": 68.07,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": "The ownership to be shifted to CX team"
  },
  {
    "KRIID": "KRI-082",
    "KRIName": "Increase in Customer Acquisition Cost (CAC) from the budgeted cost",
    "Period": "2025-Q2",
    "ActualValue": "205 SAR (With awareness campaigns) 124%\r\n118 SAR (Without awareness campaigns) 81%",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Part of our Q2 plan was to heavily spend on awareness and experiments, this will  increase our CAC on awareness which will eventually lead to a lower CAC in the future.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-081",
    "KRIName": "Policy Acquisition Cost (PAC)",
    "Period": "2025-Q2",
    "ActualValue": "164 SAR 142%",
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "Due to the may limitation and June seasonality in performance our PAC was High for Q2. In April our PAC is at 101% .",
    "ActionPlan": "In Q3, campaign setup and restructuring is happening taking advantage of the high season on all products"
  },
  {
    "KRIID": "KRI-083",
    "KRIName": "Variation in marketing budget vs actual expense",
    "Period": "2025-Q2",
    "ActualValue": 49,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Due to seasonality and new products launching, and procurement procedures we had to limit our spending",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-084",
    "KRIName": "Variation in Return on Ad Spend vs expected return",
    "Period": "2025-Q2",
    "ActualValue": 4.9,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "May and June were not fully expended due to campaigns pausing for procurement limitation, in addition to some technical issues",
    "ActionPlan": "In Q3, campaign setup and restructuring is happening taking advantage of the high season on all products"
  },
  {
    "KRIID": "KRI-085",
    "KRIName": "AD status (not more than 90 days)",
    "Period": "2025-Q2",
    "ActualValue": "30 days",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-077",
    "KRIName": "Usage of marketing material uploaded without approval",
    "Period": "2025-Q3",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "We always share the social media calendar with compliance team",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-078",
    "KRIName": "Decline in social media engagement from previous quarter (audience interaction)",
    "Period": "2025-Q3",
    "ActualValue": 2.9,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": "To increase social media engagement by having contests related to tree products, etc,.."
  },
  {
    "KRIID": "KRI-079",
    "KRIName": "Negative sentiments",
    "Period": "2025-Q3",
    "ActualValue": "Not Assessed",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "We currently don't have a platform to evaluate social media sentiment as there's no need for it since the brand is still small to have huge volume of comments/mentions in our social media accounts.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-080",
    "KRIName": "Number of Growth Experiments",
    "Period": "2025-Q3",
    "ActualValue": "1) 1 Initiative didn't achieve positive results  2) We had 4 Initiatives / Experiments in Q3",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "In Q3 2025, we ran four Growth initiatives—three succeeded, and one failed",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-081",
    "KRIName": "Policy Acquisition Cost (PAC)",
    "Period": "2025-Q3",
    "ActualValue": 86,
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "During Q3, we have restructured the spending based on the season and performance especially motor, taking into consideration the launching of new products during this duration.",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-082",
    "KRIName": "Increase in Customer Acquisition Cost (CAC) from the budgeted cost",
    "Period": "2025-Q3",
    "ActualValue": "With Awareness 158 SAR (98%)",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Due to seasonality and high demand",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-083",
    "KRIName": "Variation in marketing budget vs actual expense",
    "Period": "2025-Q3",
    "ActualValue": 99,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Seasonality budget shuffle to follow the market behavior and trend",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-084",
    "KRIName": "Variation in Return on Ad Spend vs expected return",
    "Period": "2025-Q3",
    "ActualValue": 6.77,
    "RAGStatus": "Amber",
    "Comments": "",
    "Justification": "During Q3, we have restructured the spending based on the season and performance especially motor, taking into consideration the launching of new products during this duration.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-085",
    "KRIName": "AD status (not more than 90 days)",
    "Period": "2025-Q3",
    "ActualValue": "30 days",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-077",
    "KRIName": "Usage of marketing material uploaded without approval",
    "Period": "2025-Q4",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "We always share the social media calendar with compliance team",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-078",
    "KRIName": "Decline in social media engagement from previous quarter (audience interaction)",
    "Period": "2025-Q4",
    "ActualValue": 1.8,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-079",
    "KRIName": "Negative sentiments",
    "Period": "2025-Q4",
    "ActualValue": "Not Assessed",
    "RAGStatus": null,
    "Comments": "",
    "Justification": "We currently don't have a platform to evaluate social media sentiment as there's no need for it since the brand is still small to have huge volume of comments/mentions in our social media accounts.",
    "ActionPlan": "Working on it before end of Q1 will be in place"
  },
  {
    "KRIID": "KRI-080",
    "KRIName": "Number of Growth Experiments",
    "Period": "2025-Q4",
    "ActualValue": "1) 3 Experiments run this quarter \r\n2) all 3 were successful",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "In Q4 we ran 3 Experiments and all 3 were successfull\r\n1st Exp. - Lead Popup for SME\r\n2nd Exp. Whatsapp Bot for Qualifing Leads \r\n3rd. Exp. Lead Gen on LinkedIn",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-081",
    "KRIName": "Policy Acquisition Cost (PAC)",
    "Period": "2025-Q4",
    "ActualValue": 1.14,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "During Q4, we spent more than the previous quarter to build awareness in the market about our comprehensive and Medical Malpractice products.",
    "ActionPlan": "-"
  },
  {
    "KRIID": "KRI-083",
    "KRIName": "Variation in marketing budget vs actual expense",
    "Period": "2025-Q4",
    "ActualValue": 97,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Seasonality budget shuffle to follow the market behavior and trend",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-084",
    "KRIName": "Variation in Return on Ad Spend vs expected return",
    "Period": "2025-Q4",
    "ActualValue": 6.48,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "During Q4, we have focused on comprehensive motor to generate higher revenue, taking into consideration the season of TPL, and high demand on MMP.",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-085",
    "KRIName": "AD status (not more than 90 days)",
    "Period": "2025-Q4",
    "ActualValue": "30 days",
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "",
    "ActionPlan": ""
  },
  {
    "KRIID": "KRI-086",
    "KRIName": "Completion of Strategic Projects",
    "Period": "2025-Q1",
    "ActualValue": 88,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "3 out of 4 strategic projects have been launched successfully, achieving 88% performance weight considering the target completion rate is 85%.",
    "ActionPlan": "Continue monitoring project timelines and support stakeholders with necessary resources to ensure full execution."
  },
  {
    "KRIID": "KRI-087",
    "KRIName": "Gross Written Premium (GWP)",
    "Period": "2025-Q1",
    "ActualValue": 62,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "Q1 target was SAR 82.3M while actual achievement was SAR 51M, indicating a 38% gap.",
    "ActionPlan": "Activate Sales Growth Squid initiatives and collaborate with all stakeholders to bridge the gap."
  },
  {
    "KRIID": "KRI-088",
    "KRIName": "Review of the strategic plan should be performed at least 2 times per annum",
    "Period": "2025-Q1",
    "ActualValue": 1,
    "RAGStatus": "Amber",
    "Comments": "Some corporate KPIs are designed to be measured 1 time only in alignment with the relevant stakeholders",
    "Justification": "Q1 review in progress as planned; second scheduled in Q2",
    "ActionPlan": "Ensure timely execution of the First review and communicate insights to stakeholders."
  },
  {
    "KRIID": "KRI-089",
    "KRIName": "Projects not aligned with Strategic Objectives",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "All initiated projects are aligned with Tree’s approved strategic objectives.",
    "ActionPlan": "Continue applying alignment validation during project cycles."
  },
  {
    "KRIID": "KRI-090",
    "KRIName": "Project facsed issues",
    "Period": "2025-Q1",
    "ActualValue": 5.5,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "15 risks identified: 8 closed, 7 ongoing – reflects active risk tracking for new/change projects.",
    "ActionPlan": "Maintain regular updates of risk logs and support project owners to close open risks."
  },
  {
    "KRIID": "KRI-091",
    "KRIName": "Failure to report in projects",
    "Period": "2025-Q1",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Weekly project status presentations are conducted and shared for all on going project",
    "ActionPlan": "Continue weekly project review meetings every Tuesday and escalate issues as needed."
  },
  {
    "KRIID": "KRI-086",
    "KRIName": "Completion of Strategic Projects",
    "Period": "2025-Q2",
    "ActualValue": 93,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "3 out of 4 strategic projects have been launched successfully, achieving 88% performance weight considering the target completion rate is 85%.\r\nQ2 3 out of 4 strategic projects have been launched successfully the fourth project progress is 87%",
    "ActionPlan": "Continue monitoring project timelines and support stakeholders with necessary resources to ensure full execution."
  },
  {
    "KRIID": "KRI-087",
    "KRIName": "Gross Written Premium (GWP)",
    "Period": "2025-Q2",
    "ActualValue": 68,
    "RAGStatus": "Red",
    "Comments": "",
    "Justification": "Q1 target was SAR 82.3M while actual achievement was SAR 51M, indicating a 38% gap.\r\nH1achievement 105 M target is156.2 M",
    "ActionPlan": "Extending Sales Growth Squid initiatives and collaborate with all stakeholders to bridge the gap."
  },
  {
    "KRIID": "KRI-088",
    "KRIName": "Review of the strategic plan should be performed at least 2 times per annum",
    "Period": "2025-Q2",
    "ActualValue": 2,
    "RAGStatus": "Green",
    "Comments": "Some corporate KPIs are designed to be measured 1 time only in alignment with the relevant stakeholders",
    "Justification": "Q1 review in progress as planned; second scheduled in Q2\r\nQ2 review in progress as planned; Third scheduled in Q3",
    "ActionPlan": "Ensure timely execution of the First review and communicate insights to stakeholders."
  },
  {
    "KRIID": "KRI-089",
    "KRIName": "Projects not aligned with Strategic Objectives",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "All initiated projects are aligned with Tree’s approved strategic objectives.",
    "ActionPlan": "Continue applying alignment validation during project cycles."
  },
  {
    "KRIID": "KRI-090",
    "KRIName": "Project facsed issues",
    "Period": "2025-Q2",
    "ActualValue": 5.5,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "19 Project on Going with 27 risks/ issue identified reflects active risk tracking for the projects.",
    "ActionPlan": "Maintain regular updates of risk logs and support project owners to close open risks."
  },
  {
    "KRIID": "KRI-091",
    "KRIName": "Failure to report in projects",
    "Period": "2025-Q2",
    "ActualValue": 0,
    "RAGStatus": "Green",
    "Comments": "",
    "Justification": "Weekly project status presentations are conducted and shared for all on going project",
    "ActionPlan": "Continue weekly project review meetings every Tuesday and escalate issues as needed."
  }
];

const QUARTERLY_KRIS = ["KRI-001","KRI-002","KRI-003","KRI-004","KRI-005","KRI-006","KRI-007","KRI-008","KRI-009","KRI-010","KRI-011","KRI-013","KRI-014","KRI-015","KRI-016","KRI-017","KRI-018","KRI-019","KRI-020","KRI-021","KRI-022","KRI-023","KRI-024","KRI-025","KRI-026","KRI-027","KRI-028","KRI-029","KRI-030","KRI-031","KRI-032","KRI-033","KRI-034","KRI-035","KRI-036","KRI-037","KRI-038","KRI-039","KRI-040","KRI-041","KRI-042","KRI-043","KRI-047","KRI-048","KRI-049","KRI-050","KRI-051","KRI-052","KRI-053","KRI-054","KRI-055","KRI-056","KRI-057","KRI-060","KRI-061","KRI-062","KRI-063","KRI-064","KRI-065","KRI-066","KRI-067","KRI-068","KRI-069","KRI-070","KRI-071","KRI-072","KRI-073","KRI-074","KRI-075","KRI-076","KRI-077","KRI-078","KRI-079","KRI-080","KRI-081","KRI-082","KRI-083","KRI-084","KRI-085","KRI-086","KRI-087","KRI-088","KRI-089","KRI-090","KRI-091"];

(async function importHistorical() {
  'use strict';

  const SITE = (() => {
    const { origin, pathname } = window.location;
    const match = pathname.match(/^(\/(?:sites|teams|portals|personal)\/[^/]+)/i);
    return match ? origin + match[1] : origin;
  })();

  const MASTER   = 'GRC_KRI_Master';
  const READINGS_LIST = 'GRC_KRI_Readings';

  console.group('%cGRC Historical Readings Import', 'font-weight:bold;font-size:14px');
  console.log('Target site:', SITE);

  async function getDigest() {
    const r = await fetch(SITE + '/_api/contextinfo', {
      method: 'POST',
      headers: { Accept: 'application/json;odata=nometadata' },
      credentials: 'include',
    });
    if (!r.ok) throw new Error('Cannot get digest — are you logged into SharePoint?');
    const d = await r.json();
    return d.FormDigestValue;
  }

  const spGet = (url) => fetch(SITE + url, {
    headers: { Accept: 'application/json;odata=nometadata' },
    credentials: 'include',
  });

  let digest = await getDigest();

  // ── Step 1: Add Justification + ActionPlan columns to GRC_KRI_Readings ────
  console.group('Step 1: Ensure Justification + ActionPlan columns exist');
  const newCols = [
    { Title: 'Justification', FieldTypeKind: 3 }, // Note
    { Title: 'ActionPlan',    FieldTypeKind: 3 }, // Note
  ];
  for (const col of newCols) {
    const check = await spGet(`/_api/web/lists/getbytitle('${READINGS_LIST}')/fields/getbyinternalnameortitle('${col.Title}')`);
    if (check.ok) {
      console.log('  ↩ ' + col.Title + ' already exists');
      continue;
    }
    digest = await getDigest();
    const r = await fetch(SITE + `/_api/web/lists/getbytitle('${READINGS_LIST}')/fields`, {
      method: 'POST',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=verbose',
        'X-RequestDigest': digest,
      },
      credentials: 'include',
      body: JSON.stringify({
        __metadata: { type: 'SP.FieldMultiLineText' },
        FieldTypeKind: col.FieldTypeKind,
        Title: col.Title,
        Required: false,
        RichText: false,
        AppendOnly: false,
      }),
    });
    if (r.ok) console.log('  ✓ Added ' + col.Title);
    else console.warn('  ⚠ Failed to add ' + col.Title + ':', (await r.text()).slice(0, 200));
  }
  console.groupEnd();

  // ── Step 2: Update ReportingFrequency for KRIs that have historical data ──
  console.group('Step 2: Set Quarterly frequency for ' + QUARTERLY_KRIS.length + ' KRIs');
  // Fetch all KRIs to get their SP ID
  const masterRes = await spGet(`/_api/web/lists/getbytitle('${MASTER}')/items?$select=ID,KRIID,ReportingFrequency&$top=2000`);
  const masterItems = (await masterRes.json()).value || [];
  const idByKRI = {};
  masterItems.forEach(it => { if (it.KRIID) idByKRI[it.KRIID] = it.ID; });

  let updated = 0, skipped = 0;
  for (const kriId of QUARTERLY_KRIS) {
    const spId = idByKRI[kriId];
    if (!spId) { skipped++; continue; }
    digest = await getDigest();
    const r = await fetch(SITE + `/_api/web/lists/getbytitle('${MASTER}')/items(${spId})`, {
      method: 'POST',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=nometadata',
        'X-RequestDigest': digest,
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE',
      },
      credentials: 'include',
      body: JSON.stringify({ ReportingFrequency: 'Quarterly' }),
    });
    if (r.ok) {
      updated++;
      if (updated % 20 === 0) console.log('  ✓ ' + updated + '/' + QUARTERLY_KRIS.length);
    } else {
      skipped++;
    }
  }
  console.log('  ✓ Set Quarterly: ' + updated + ' · Skipped: ' + skipped);
  console.groupEnd();

  // ── Step 3: Insert all historical readings ────────────────────────────────
  console.group('Step 3: Insert ' + READINGS.length + ' historical readings');
  let inserted = 0, failed = 0;
  for (const r of READINGS) {
    digest = await getDigest();
    // Coerce numeric ActualValue when possible; SP field is Number
    let actual = r.ActualValue;
    if (typeof actual === 'string') {
      const m = actual.match(/-?\d+(\.\d+)?/);
      actual = m ? parseFloat(m[0]) : null;
    }
    if (actual == null || !Number.isFinite(actual)) { failed++; continue; }

    const body = {
      Title:        (r.KRIID || '') + '-' + r.Period,
      KRIID:        r.KRIID,
      KRIName:      r.KRIName,
      ReadingDate:  new Date().toISOString(),
      ActualValue:  actual,
      Period:       r.Period,
      RAGStatus:    r.RAGStatus || null,
      Trend:        'Stable',
      Comments:     r.Comments || '',
      Justification:r.Justification || '',
      ActionPlan:   r.ActionPlan || '',
    };
    const resp = await fetch(SITE + `/_api/web/lists/getbytitle('${READINGS_LIST}')/items`, {
      method: 'POST',
      headers: {
        Accept: 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=nometadata',
        'X-RequestDigest': digest,
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (resp.ok) {
      inserted++;
      if (inserted % 25 === 0) console.log('  ✓ ' + inserted + '/' + READINGS.length);
    } else {
      failed++;
      if (failed <= 5) {
        const t = await resp.text();
        console.warn('  ⚠ ' + r.KRIID + ' ' + r.Period + ' — ' + t.slice(0, 200));
      }
    }
  }
  console.log('  ✓ Inserted: ' + inserted + ' / ' + READINGS.length + (failed ? ' (failed: ' + failed + ')' : ''));
  console.groupEnd();

  console.log('%c✓ Historical import complete', 'color:#16a34a;font-weight:bold');
  console.groupEnd();
})();
