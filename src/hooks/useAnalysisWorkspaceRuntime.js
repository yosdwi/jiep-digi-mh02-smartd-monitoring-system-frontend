import { useEffect } from "react";
import { installVendorGlobals } from "../runtime/vendorGlobals";
import { mountAnalysisWorkspaceRuntime } from "../runtime/analysisWorkspaceRuntime";
import { installRuntimeConfig } from "../runtime/runtimeConfig";

export function useAnalysisWorkspaceRuntime() {
  useEffect(() => {
    installRuntimeConfig();
    installVendorGlobals();
    return mountAnalysisWorkspaceRuntime();
  }, []);
}
