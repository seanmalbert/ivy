import { defineConfig } from "wxt";
import path from "node:path";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  webExt: {
    chromiumProfile: path.resolve(__dirname, ".chrome-profile"),
    keepProfileChanges: true,
    startUrls: ["https://www.ssa.gov/benefits/"],
  },
  manifest: {
    name: "Ivy - Personal Web Assistant",
    description:
      "AI-powered assistant that adapts web content to your needs. Simplifies text, discovers benefits, and guides you through forms.",
    permissions: ["activeTab", "storage", "sidePanel", "scripting"],
    host_permissions: [],
    side_panel: {
      default_path: "sidepanel.html",
    },
    action: {
      default_popup: "popup.html",
      default_icon: {
        "16": "icon/16.png",
        "32": "icon/32.png",
        "48": "icon/48.png",
        "128": "icon/128.png",
      },
    },
  },
});
