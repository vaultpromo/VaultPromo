import { verifySession } from "@/lib/dal";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export default async function NewCampaignPage() {
  await verifySession(); // protect the page server-side
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">New Campaign</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Set up your promo release details. You can add tracks after saving.
        </p>
      </div>
      <CampaignForm />
    </div>
  );
}
