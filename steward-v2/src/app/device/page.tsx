import type { Metadata } from "next";
import { DevicePage } from "@/components/device/DevicePage";

export const metadata: Metadata = {
  title: "Steward Bot · Device",
  description: "A pocket multi-tool for office managers: camera, screen, voice and six folding tools.",
};

export default function Page() {
  return <DevicePage />;
}
