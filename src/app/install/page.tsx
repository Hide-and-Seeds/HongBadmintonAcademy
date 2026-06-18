import type { Metadata } from "next";
import { InstallClient } from "./install-client";

export const metadata: Metadata = {
  title: "Install Hong Badminton Academy",
  description: "Add HBA to your home screen.",
};

export default function InstallPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-white">
      <InstallClient />
    </div>
  );
}
