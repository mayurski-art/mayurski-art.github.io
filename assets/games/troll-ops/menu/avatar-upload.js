/* Upload a picture in the Barracks (user, 2026-10-29: "upload your profile
   picture ... an image of their troll nft character"). Same upload the
   site's Settings modal does (TrollrunnerAccounts.uploadAvatar: square crop,
   webp, saved as the profile's avatar_url), so the new picture reaches the
   card, the top bar and the party row through the auth-changed its profile
   refresh sends. The file picker needs a click or a key press to open;
   browsers don't count a pad button as one. */

let input = null;

export function pickAvatar(setStatus) {
  const accounts = window.TrollrunnerAccounts;
  if (!accounts?.getCachedProfile?.()) { setStatus("Sign in to upload a picture."); return; }
  if (!input) {
    input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/heic,image/heif";
    input.hidden = true;
    document.body.appendChild(input);
  }
  input.value = "";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    setStatus("Uploading your picture…");
    try {
      await accounts.uploadAvatar(file);
      setStatus("New profile picture saved.");
    } catch (err) {
      setStatus(`Couldn't upload: ${err.message}`);
    }
  };
  input.click();
}
