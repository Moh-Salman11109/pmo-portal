import { createContext, useContext } from "react";

export const DeptContext = createContext(null);
export const useDepts = () => useContext(DeptContext);
