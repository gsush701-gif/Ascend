// Ascend project config for the extension.
//
// SUPABASE_URL / SUPABASE_ANON_KEY are the same public values the web app
// bundles into its client-side JS (see src/lib/supabaseClient.ts). The anon
// key is safe to ship in a public client by Supabase's own design — RLS
// policies (auth.uid() = user_id on `roles`) are what actually protect data,
// not secrecy of this key. Nothing here is a credential.
module.exports = {
  SUPABASE_URL: "https://dwiwayffvlbokffyyuwy.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_ThbeG8PSzzj6PND7eHASXw_q9xWS5QL",
  ASCEND_APP_URL: "https://ascend-app-60ef.onrender.com",
};
