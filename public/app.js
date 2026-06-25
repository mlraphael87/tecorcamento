const form = document.querySelector("#budgetForm");
const historySelect = document.querySelector("#historySelect");
const searchInput = document.querySelector("#searchInput");
const printButton = document.querySelector("#printButton");
const newButton = document.querySelector("#newButton");
const refreshOs = document.querySelector("#refreshOs");
const statusBox = document.querySelector("#status");

const fields = [
  "os_numero",
  "data",
  "paciente",
  "cpf",
  "contato",
  "origem",
  "nascimento",
  "concessao",
  "fabricante",
  "modelo",
  "serie",
  "fabricante2",
  "modelo2",
  "serie2",
  "servico",
  "pecas",
  "valor_total",
  "valor_extenso",
  "observacao",
  "observacao2",
];

const el = Object.fromEntries(fields.map((name) => [name, document.querySelector(`#${name}`)]));

const p = {
  os: document.querySelector("#p_os"),
  data: document.querySelector("#p_data"),
  paciente: document.querySelector("#p_paciente"),
  cpf: document.querySelector("#p_cpf"),
  contato: document.querySelector("#p_contato"),
  origem: document.querySelector("#p_origem"),
  nascimento: document.querySelector("#p_nascimento"),
  concessao: document.querySelector("#p_concessao"),
  fabricante: document.querySelector("#p_fabricante"),
  modelo: document.querySelector("#p_modelo"),
  serie: document.querySelector("#p_serie"),
  fabricante2: document.querySelector("#p_fabricante2"),
  modelo2: document.querySelector("#p_modelo2"),
  serie2: document.querySelector("#p_serie2"),
  servico: document.querySelector("#p_servico"),
  pecas: document.querySelector("#p_pecas"),
  valor: document.querySelector("#p_valor"),
  extenso: document.querySelector("#p_extenso"),
  observacao: document.querySelector("#p_observacao"),
  observacao2: document.querySelector("#p_observacao2"),
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function padOs(value) {
  return String(value || "").padStart(4, "0");
}

function parseMoney(value) {
  if (typeof value === "number") return value;
  const normalized = String(value || "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  return parseMoney(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatCpf(value) {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return value || "";
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1 $2 $3 $4");
}

function numberToWords(number) {
  const units = ["", "um", "dois", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function chunkToWords(value) {
    if (value === 0) return "";
    if (value === 100) return "cem";
    const words = [];
    const hundred = Math.floor(value / 100);
    const rest = value % 100;
    if (hundred) words.push(hundreds[hundred]);
    if (rest >= 10 && rest < 20) words.push(teens[rest - 10]);
    else {
      const ten = Math.floor(rest / 10);
      const unit = rest % 10;
      if (ten) words.push(tens[ten]);
      if (unit) words.push(units[unit]);
    }
    return words.join(" e ");
  }

  const inteiro = Math.floor(Math.abs(number));
  const centavos = Math.round((Math.abs(number) - inteiro) * 100);
  if (inteiro === 0 && centavos === 0) return "ZERO REAL";

  const milhares = Math.floor(inteiro / 1000);
  const resto = inteiro % 1000;
  const parts = [];
  if (milhares === 1) parts.push("mil");
  else if (milhares > 1) parts.push(`${chunkToWords(milhares)} mil`);
  if (resto) parts.push(chunkToWords(resto));

  let text = `${parts.join(" e ")} ${inteiro === 1 ? "real" : "reais"}`;
  if (centavos) {
    text += ` e ${chunkToWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
  }
  return text.toUpperCase();
}

function getPayload() {
  return Object.fromEntries(fields.map((name) => [name, el[name].value]));
}

function setForm(data) {
  fields.forEach((name) => {
    if (data[name] !== undefined && el[name]) el[name].value = data[name] || "";
  });
  if (data.valor_total !== undefined) el.valor_total.value = String(data.valor_total).replace(".", ",");
  updatePreview();
}

function updatePreview() {
  const data = getPayload();
  const valor = parseMoney(data.valor_total);
  if (valor > 0 && !document.activeElement.isSameNode(el.valor_extenso)) {
    el.valor_extenso.value = numberToWords(valor);
    data.valor_extenso = el.valor_extenso.value;
  }

  p.os.textContent = padOs(data.os_numero || "0");
  p.data.textContent = formatDate(data.data);
  p.paciente.textContent = data.paciente.toUpperCase();
  p.cpf.textContent = formatCpf(data.cpf);
  p.contato.textContent = data.contato;
  p.origem.textContent = data.origem.toUpperCase();
  p.nascimento.textContent = formatDate(data.nascimento);
  p.concessao.textContent = formatDate(data.concessao);
  p.fabricante.textContent = data.fabricante.toUpperCase();
  p.modelo.textContent = data.modelo.toUpperCase();
  p.serie.textContent = data.serie.toUpperCase();
  p.fabricante2.textContent = data.fabricante2.toUpperCase();
  p.modelo2.textContent = data.modelo2.toUpperCase();
  p.serie2.textContent = data.serie2.toUpperCase();
  p.servico.textContent = data.servico.toUpperCase();
  p.pecas.textContent = data.pecas ? `PECAS: ${data.pecas.toUpperCase()}` : "";
  p.valor.textContent = formatMoney(valor);
  p.extenso.textContent = data.valor_extenso.toUpperCase();
  p.observacao.textContent = data.observacao.toUpperCase();
  p.observacao2.textContent = data.observacao2.toUpperCase();
}

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error((data.errors || [data.error]).join("\n"));
  return data;
}

async function loadNextOs() {
  const data = await api("/api/next-os");
  el.os_numero.value = data.next;
  updatePreview();
}

async function loadHistory(query = "") {
  const rows = await api(`/api/orcamentos?q=${encodeURIComponent(query)}`);
  historySelect.innerHTML = '<option value="">Historico salvo</option>';
  rows.forEach((row) => {
    const option = document.createElement("option");
    option.value = row.id;
    option.textContent = `OS ${padOs(row.os_numero)} - ${row.paciente} - ${formatDate(row.data)}`;
    historySelect.appendChild(option);
  });
}

async function saveBudget(event) {
  event.preventDefault();
  statusBox.classList.remove("error");
  statusBox.textContent = "Salvando...";
  const payload = getPayload();
  payload.valor_total = parseMoney(payload.valor_total);
  payload.valor_extenso = payload.valor_extenso || numberToWords(payload.valor_total);

  try {
    const saved = await api("/api/orcamentos", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await loadHistory(searchInput.value);
    await resetForm(`Orcamento OS ${padOs(saved.os_numero)} salvo.`);
  } catch (error) {
    statusBox.classList.add("error");
    statusBox.textContent = error.message;
  }
}

async function loadSelectedBudget() {
  if (!historySelect.value) return;
  const budget = await api(`/api/orcamentos/${historySelect.value}`);
  setForm(budget);
}

async function resetForm(message = "") {
  form.reset();
  historySelect.value = "";
  el.data.value = today();
  await loadNextOs();
  statusBox.classList.remove("error");
  statusBox.textContent = message;
  updatePreview();
}

fields.forEach((name) => el[name].addEventListener("input", updatePreview));
form.addEventListener("submit", saveBudget);
historySelect.addEventListener("change", loadSelectedBudget);
refreshOs.addEventListener("click", loadNextOs);
newButton.addEventListener("click", resetForm);
printButton.addEventListener("click", () => window.print());
searchInput.addEventListener("input", () => loadHistory(searchInput.value));

el.data.value = today();
loadNextOs();
loadHistory();
updatePreview();
