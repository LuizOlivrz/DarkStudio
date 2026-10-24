// DarkStudio — Interface de doações Pix
// Mantém os eventos fora do HTML.

const donationButton = document.getElementById("creator-donation-button");
const donationDialog = document.getElementById("creator-donation-dialog");
const closeDonationButton = document.getElementById("creator-donation-close");
const pixCodeField = document.getElementById("creator-pix-code");
const copyPixButton = document.getElementById("creator-pix-copy");
const pixStatus = document.getElementById("creator-pix-status");

if (
  donationButton &&
  donationDialog instanceof HTMLDialogElement &&
  closeDonationButton &&
  pixCodeField instanceof HTMLTextAreaElement &&
  copyPixButton &&
  pixStatus
) {
  donationButton.addEventListener("click", () => {
    pixStatus.textContent = "";
    donationDialog.showModal();
    closeDonationButton.focus();
  });

  closeDonationButton.addEventListener("click", () => donationDialog.close());

  donationDialog.addEventListener("click", (event) => {
    if (event.target === donationDialog) donationDialog.close();
  });

  copyPixButton.addEventListener("click", async () => {
    const pixCode = pixCodeField.value.trim();
    if (!pixCode) return;

    try {
      await navigator.clipboard.writeText(pixCode);
      pixStatus.textContent = "Código Pix copiado.";
    } catch {
      pixCodeField.focus();
      pixCodeField.select();
      const copied = document.execCommand("copy");
      pixStatus.textContent = copied
        ? "Código Pix copiado."
        : "Não foi possível copiar automaticamente. Selecione e copie o código.";
    }
  });
}
