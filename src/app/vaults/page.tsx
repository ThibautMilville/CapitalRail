import type { Metadata } from "next";
import { VaultsPage } from "@/features/vaults/ui/VaultsPage";

export const metadata: Metadata = {
  title: "Vaults - CapitalRail",
  description:
    "Live IXS High Yield Bond USDC vault catalogue: TVL, settlement, access and recent subgraph activity.",
};

export default function VaultsRoute() {
  return <VaultsPage />;
}
