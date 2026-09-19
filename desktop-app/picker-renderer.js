let selecionado = null;

window.pickerAPI.onFontes((fontes) => {
  const grid = document.getElementById("grid");
  fontes.forEach((f) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<img src="${f.thumbnail}"><p>${f.name}</p>`;
    card.onclick = () => {
      document.querySelectorAll(".card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      selecionado = f.id;
    };
    grid.appendChild(card);
  });
});

document.getElementById("compartilhar").onclick = () => {
  if (!selecionado) return;
  window.pickerAPI.escolher(selecionado, document.getElementById("audio").checked);
};
document.getElementById("cancelar").onclick = () => window.pickerAPI.cancelar();

window.pickerAPI.pronto();