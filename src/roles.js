export const ROLE_ADMIN      = "pmo_admin";
export const ROLE_PM         = "pm";
export const ROLE_EXEC       = "executive";
export const ROLE_DEPT_HEAD  = "dept_head";
export const ROLE_GRC        = "grc";         // view GRC dashboard only
export const ROLE_GRC_ADMIN  = "grc_admin";   // view + full edit GRC dashboard
export const ROLE_PMO_HEAD   = "pmo_head";    // all pmo_admin permissions except GRC dashboard
export const ROLE_PMO_STAFF  = "pmo_staff";   // validate/return PM updates only — no edit/delete/add
export const ROLE_LOCKED     = "locked";      // IsActive=No in PMO_Users — no portal access
