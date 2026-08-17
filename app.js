/* =========================================================
   Canal de Denúncias — Fonsatti | Franzin
   Versão vanilla (HTML + CSS + JS puro, sem build/framework)
   Backend: Supabase (mesmas funções RPC seguras da versão React)
   ========================================================= */

/* ---------- domínio / constantes ---------- */
const CATEGORY_DEFS = [
  { id: "moral", label: "Assédio Moral", color: "#5B7DA6" },
  { id: "sexual", label: "Assédio Sexual", color: "#8B5A83" },
  { id: "eleitoral", label: "Assédio Eleitoral", color: "#A4823E" },
  { id: "outra", label: "Outra violência", color: "#6E7482" },
];

const STATUS_STEPS = ["recebida", "coleta_provas", "em_analise", "concluida"];
const STATUS_LABEL = {
  recebida: "Recebida",
  coleta_provas: "Coleta de provas",
  em_analise: "Em análise",
  concluida: "Concluída",
};

const AUTO_MESSAGES = {
  recebida: "Nós recebemos sua denúncia. Iremos tratá-la com atenção, cuidado e respeito às suas colocações. Acompanhe o andamento a qualquer momento através do número de protocolo.",
  coleta_provas: "Sua denúncia entrou na fase de coleta de provas e informações complementares. Se desejar, você pode enviar documentos, detalhes ou novos fatos por este canal.",
  em_analise: "Sua denúncia está em fase de análise pelo comitê de apuração. Retornaremos por aqui assim que a apuração for concluída.",
};

const RESPOSTAS_PADRAO = [
  { id: "medidas_adotadas", label: "Medidas adotadas", texto: "Sua denúncia foi analisada e concluída pelo comitê de apuração. Foram adotadas as medidas cabíveis previstas em nossas políticas internas de conduta e ética, respeitado o sigilo do processo e das pessoas envolvidas." },
  { id: "encaminhamentos_internos", label: "Encaminhamentos internos", texto: "Sua denúncia foi analisada e concluída. Após a apuração dos fatos, foram determinados encaminhamentos junto às áreas responsáveis, incluindo ações internas de reforço de conduta e prevenção." },
  { id: "sem_caracterizacao", label: "Sem caracterização de assédio", texto: "Sua denúncia foi analisada e concluída. Não foram encontrados elementos suficientes para caracterizar a conduta relatada como assédio. Caso situações semelhantes voltem a ocorrer, você pode registrar uma nova denúncia a qualquer momento, incluindo novos fatos ou evidências." },
];

const RESULTADO_OPTIONS = [
  { id: "sancao_disciplinar", label: "Sanção disciplinar aplicada" },
  { id: "renovacao_treinamento", label: "Renovação/reforço de treinamento determinado" },
  { id: "orientacao", label: "Orientação ao denunciante (assédio não caracterizado)" },
];

const VINCULO_LABEL = {
  clt: "CLT", terceirizado: "Terceirizado", pj: "PJ / Autônomo",
  estagiario: "Estagiário", cliente_fornecedor: "Cliente / Fornecedor", outro: "Outro",
};
const SOBRE_QUEM_LABEL = {
  comigo: "Aconteceu com o(a) denunciante", outra_pessoa: "Relato sobre outra pessoa",
};
const HIERARQUIA_LABEL = {
  superior: "Denunciado é superior hierárquico",
  mesmo_nivel: "Mesmo nível hierárquico",
  subordinado: "Denunciado é subordinado ao denunciante",
};

const DEFAULT_TENANT = { name: "Empresa Demonstração", primary: "#A4823E" };
const MAX_ANEXOS_BYTES = 3 * 1024 * 1024;

/* ---------- helpers ---------- */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

async function computeIntegrityCode(payload) {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(JSON.stringify(payload));
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32).toUpperCase();
  } catch {
    return "INDISPONÍVEL";
  }
}

function getSlugFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search).get("empresa");
    return (p || "demo").toLowerCase().replace(/[^a-z0-9-]/g, "");
  } catch {
    return "demo";
  }
}

function genProtocol(slug) {
  const prefix = (slug || "EMP").slice(0, 3).toUpperCase();
  const now = new Date();
  const ym = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${ym}-${rand}`;
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function dataUrlSizeBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

// Comprime imagens grandes para caberem no limite de anexos
function compressImageFile(file, maxDim = 1600, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

/* ---------- cliente Supabase ---------- */
const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
// Captura isso JÁ, de forma síncrona — o próprio Supabase limpa esse
// trecho da URL assim que reconhece a sessão, então não podemos esperar
// nenhuma operação assíncrona (como buscar dados no banco) antes de checar.
const IS_PASSWORD_RECOVERY = window.location.hash.includes("type=recovery");

// Depois de clicar no link de "esqueci minha senha", o Supabase leva um instante
// para reconhecer a sessão de recuperação. Espera um pouco antes de desistir.
async function waitForRecoverySession(retries = 6) {
  for (let i = 0; i < retries; i++) {
    const { data } = await sb.auth.getSession();
    if (data.session) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/* ---------- storage roteado para funções seguras (RPC) ---------- */
async function storageGet(key) {
  try {
    const [kind, a, b] = key.split(":");
    if (kind === "tenant") {
      const { data, error } = await sb.rpc("get_tenant_public", { p_slug: a });
      return error ? null : data;
    }
    if (kind === "denuncia") {
      const { data, error } = await sb.rpc("get_denuncia_by_protocolo", { p_slug: a, p_protocolo: b });
      return error ? null : data;
    }
    if (kind === "denuncias-index") {
      const { data, error } = await sb.rpc("admin_list_protocolos", { p_slug: a });
      if (error || !data) return [];
      return data.map((r) => r.protocolo);
    }
    return null;
  } catch {
    return null;
  }
}

async function storageSet(key, value) {
  try {
    const [kind, a, b] = key.split(":");
    if (kind === "tenant") {
      const { error } = await sb.rpc("save_tenant", { p_slug: a, p_data: value });
      return !error;
    }
    if (kind === "denuncia") {
      const { error } = await sb.rpc("upsert_denuncia", { p_slug: a, p_protocolo: b, p_data: value });
      return !error;
    }
    return true;
  } catch {
    return false;
  }
}

/* ---------- estado global ---------- */
const state = {
  slug: getSlugFromUrl(),
  tenant: null,
  view: "home",
  lastProtocol: "",
  adminOk: false,
  // acompanhar
  acompanharDenuncia: null,
  // admin
  adminList: [],
  adminSelected: null,
  adminTab: "lista",
  isSuperAdmin: false,
  adminViewSlug: null,
  adminViewTenantName: null,
  superTenants: [],
};

const viewContainer = document.getElementById("view-container");
const backBtn = document.getElementById("btn-back");
const brandEl = document.getElementById("brand");

function goto(view) {
  if (view === "admin" && !state.adminOk) {
    state.view = "admin-login";
  } else {
    state.view = view;
  }
  render();
}

backBtn.addEventListener("click", () => goto("home"));

function renderHeader() {
  backBtn.style.display = state.view === "home" ? "none" : "inline-flex";
  const name = state.tenant?.name || "Canal de Denúncias";
  const logo = state.tenant?.logo;
  brandEl.innerHTML = `${logo ? `<img src="${esc(logo)}" alt="" />` : ""}<span>${esc(name)}</span>`;
}

function render() {
  renderHeader();
  viewContainer.innerHTML = "";
  const map = {
    home: renderHome,
    nova: renderNovaDenuncia,
    protocolo: renderProtocoloGerado,
    acompanhar: renderAcompanhar,
    "admin-login": renderAdminLogin,
    "reset-senha": renderResetSenha,
    privacidade: renderPrivacidade,
    admin: renderAdminPanel,
  };
  (map[state.view] || renderHome)();
}

/* ---------- inicialização ---------- */
function shadeColor(hex, percent) {
  try {
    const f = parseInt(hex.slice(1), 16), t = percent < 0 ? 0 : 255, p = Math.abs(percent);
    const R = f >> 16, G = (f >> 8) & 0x00ff, B = f & 0x0000ff;
    return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
  } catch {
    return hex;
  }
}

function applyTenantTheme(tenant) {
  const primary = /^#[0-9A-Fa-f]{6}$/.test(tenant.primary || "") ? tenant.primary : "#A4823E";
  document.documentElement.style.setProperty("--gold", primary);
  document.documentElement.style.setProperty("--gold-soft", shadeColor(primary, -0.25));
  document.documentElement.style.setProperty("--surface2", shadeColor(primary, 0.88));
  document.documentElement.style.setProperty("--border", shadeColor(primary, 0.72));

  // Fundo geral da página: usa a cor definida manualmente pelo cliente (campo "background"),
  // ou, se não houver, um tom bem suave derivado automaticamente da cor principal.
  const bg = /^#[0-9A-Fa-f]{6}$/.test(tenant.background || "") ? tenant.background : shadeColor(primary, 0.96);
  document.documentElement.style.setProperty("--bg", bg);
  document.documentElement.style.setProperty("--surface", shadeColor(primary, 0.92));
}

async function init() {
  viewContainer.innerHTML = `<div class="view" style="text-align:center;padding-top:60px;color:var(--ink-muted)">Carregando...</div>`;
  let t = await storageGet(`tenant:${state.slug}`);
  if (!t) {
    // Nenhum tenant cadastrado: mostra um padrão só em memória.
    // Tenants reais são cadastrados no Supabase ao integrar um novo cliente.
    t = { ...DEFAULT_TENANT, name: state.slug === "demo" ? DEFAULT_TENANT.name : state.slug };
  }
  state.tenant = t;
  applyTenantTheme(t);
  if (IS_PASSWORD_RECOVERY) {
    state.view = "reset-senha";
  }
  render();
}
init();

/* =========================================================
   TELA: Home
   ========================================================= */
function renderHome() {
  const el = document.createElement("div");
  el.className = "view";
  el.style.textAlign = "center";
  el.innerHTML = `
    ${state.tenant.logo ? `<img src="${esc(state.tenant.logo)}" alt="" style="max-height:64px;max-width:220px;margin:0 auto 16px;display:block" />` : ""}
    <h2>${esc(state.tenant.name)}</h2>
    <p class="subtitle">Canal de recebimento e acompanhamento de denúncias de assédio moral, sexual e eleitoral. Operado por Fonsatti | Franzin Advogados Associados.</p>
    <div class="card" style="text-align:left;font-size:12px;color:var(--ink-muted)">
      Suas informações são tratadas com confidencialidade, nos termos da LGPD (Lei nº 13.709/2018) e da Lei nº 14.457/2022, que garante o anonimato do denunciante.
    </div>
    <button class="btn" id="btn-nova" style="margin-bottom:10px">Fazer uma denúncia</button>
    <button class="btn ghost" id="btn-acompanhar">Acompanhar denúncia</button>
    <button class="link-btn" id="btn-admin">Área do comitê de apuração</button>
    <div><button class="link-btn" id="btn-privacidade" style="text-decoration:underline">Política de Privacidade</button></div>
  `;
  viewContainer.appendChild(el);
  el.querySelector("#btn-nova").onclick = () => goto("nova");
  el.querySelector("#btn-acompanhar").onclick = () => goto("acompanhar");
  el.querySelector("#btn-admin").onclick = () => goto("admin-login");
  el.querySelector("#btn-privacidade").onclick = () => goto("privacidade");
}

/* =========================================================
   TELA: Política de Privacidade
   Texto fornecido pela Fonsatti | Franzin. "[Nome da Empresa]" é
   substituído automaticamente pelo nome do tenant atual — não
   precisa editar nada por cliente.
   ========================================================= */
function renderPrivacidade() {
  const nome = esc(state.tenant.name);
  const el = document.createElement("div");
  el.className = "view";
  el.innerHTML = `
    <button class="link-btn" id="btn-voltar-privacidade" style="margin:0 0 16px">← Voltar</button>
    <h2 style="margin-bottom:2px">Política de Privacidade</h2>
    <p class="subtitle">Canal de Denúncias de ${nome} — como tratamos os dados de quem denuncia, testemunhas e pessoas denunciadas.</p>

    <div class="card" style="text-align:left">
      <h3>1. Quem trata os seus dados</h3>
      <p><b>Controladora:</b> ${nome}, responsável por decidir as finalidades do tratamento e por conduzir a apuração das denúncias por meio de seu comitê de apuração.</p>
      <p><b>Operadora:</b> Fonsatti | Franzin Advogados Associados, responsável por disponibilizar e manter esta plataforma em nome da controladora, mediante contrato de operação de dados, sem acesso ao conteúdo das denúncias além do estritamente necessário ao suporte técnico e jurídico contratado.</p>

      <h3>2. Quais dados coletamos</h3>
      <p>Categoria da denúncia, relato dos fatos, data e local aproximados, setor, pessoas envolvidas e testemunhas quando informadas, descrição de provas e arquivos anexados, dados de identificação apenas se você optar por se identificar, e o histórico de mensagens trocadas com o comitê de apuração.</p>
      <p>Se você optar pelo anonimato, nenhum dado técnico (IP, e-mail, dispositivo) é usado para tentar identificá-lo. O número de protocolo não é derivado de nenhum dado pessoal.</p>

      <h3>3. Por que tratamos esses dados</h3>
      <p>Exclusivamente para recebimento, apuração e encerramento de denúncias de assédio moral, sexual e eleitoral, e para a comunicação com o denunciante durante esse processo — com base no cumprimento de obrigação legal da controladora (art. 7º, II, e art. 11, II, "a", da LGPD), decorrente do art. 23 da Lei nº 14.457/2022.</p>

      <h3>4. Como protegemos seus dados</h3>
      <p>Acesso restrito ao comitê de apuração e a pessoas autorizadas pela controladora, com perfis de acesso individuais; criptografia em trânsito e em repouso; registro de auditoria de quem acessa, altera a fase ou responde cada denúncia.</p>

      <h3>5. Com quem seus dados podem ser compartilhados</h3>
      <p>Comitê de apuração de ${nome}; Fonsatti | Franzin Advogados Associados, como operadora e apoio jurídico; autoridades públicas quando exigido por lei ou ordem judicial; e, quando necessário, relatório exportado para juntada em processo administrativo, trabalhista ou judicial, com base no exercício regular de direitos (art. 11, II, "d", da LGPD).</p>
      <p>Seus dados não são vendidos, alugados ou compartilhados para fins comerciais ou publicitários, em nenhuma hipótese.</p>

      <h3>6. Por quanto tempo guardamos seus dados</h3>
      <p>Pelo tempo necessário à apuração e, após a conclusão, pelo prazo adicional necessário para eventual defesa em processo relacionado ao caso, observados os prazos prescricionais aplicáveis. Encerrados esses prazos, os dados são eliminados ou anonimizados, salvo obrigação legal de retenção por prazo diverso.</p>

      <h3>7. Seus direitos</h3>
      <p>Se você se identificou, pode a qualquer momento confirmar a existência de tratamento, acessar, corrigir, solicitar anonimização/eliminação ou informações sobre compartilhamento dos seus dados (art. 18 da LGPD). Se optou pelo anonimato, não é possível atender pedidos que exijam identificá-lo, já que nenhum dado técnico liga o protocolo à sua identidade.</p>

      <h3>8. Proteção contra retaliação</h3>
      <p>${nome} veda qualquer forma de retaliação contra quem denuncia de boa-fé, inclusive demissão, rebaixamento, isolamento ou qualquer prejuízo funcional decorrente do uso deste Canal.</p>

      <h3>9. Incidentes de segurança</h3>
      <p>Em caso de incidente que possa causar risco ou dano relevante, a controladora comunicará a ANPD e os titulares afetados em até 3 (três) dias úteis do conhecimento do incidente, nos termos do art. 48 da LGPD e da Resolução CD/ANPD nº 15/2024.</p>

      <h3>10. Encarregado (DPO)</h3>
      <p>Dúvidas sobre esta Política podem ser dirigidas ao encarregado indicado por ${nome} ou, na ausência de indicação específica, ao canal de contato geral da empresa.</p>

      <h3>11. Atualizações desta Política</h3>
      <p>Esta Política pode ser atualizada para refletir mudanças na legislação ou no funcionamento do Canal. A versão vigente está sempre disponível dentro da própria plataforma.</p>

      <p style="font-size:11px;color:var(--ink-muted);margin-top:20px;border-top:1px solid var(--border);padding-top:12px">
        Base legal: Lei nº 13.709/2018 (LGPD), arts. 5º, 7º, 11, 15, 16, 18, 46 e 48; Lei nº 14.457/2022, art. 23; Resolução CD/ANPD nº 15/2024.
      </p>
    </div>
  `;
  viewContainer.appendChild(el);
  el.querySelector("#btn-voltar-privacidade").onclick = () => goto("home");
}

/* =========================================================
   TELA: Nova denúncia
   ========================================================= */
let novaForm = null;
function freshNovaForm() {
  return {
    categoria: "", relato: "", dataFato: "", local: "", setor: "",
    envolvidos: "", testemunhas: "", provasDescricao: "",
    vinculo: "", sobreQuem: "", recorrencia: "", hierarquia: "",
    anexos: [], anonimo: true, contato: "", consent: false,
  };
}

function renderNovaDenuncia() {
  novaForm = freshNovaForm();
  const el = document.createElement("div");
  el.className = "view";
  el.innerHTML = `
    <h2>Registrar denúncia</h2>
    <p class="subtitle">Todos os campos marcados com * são obrigatórios.</p>

    <div class="field">
      <label>Categoria <span class="req">*</span></label>
      <div class="cat-grid" id="cat-grid">
        ${CATEGORY_DEFS.map((c) => `
          <button type="button" class="cat-btn" data-cat="${c.id}">
            <span class="cat-dot" style="background:${c.color}"></span>${esc(c.label)}
          </button>`).join("")}
      </div>
    </div>

    <div class="field">
      <label>Relato dos fatos <span class="req">*</span> (mínimo 20 caracteres)</label>
      <textarea id="f-relato" placeholder="Descreva o que aconteceu..."></textarea>
    </div>

    <div class="field"><label>Data aproximada do fato</label><input type="date" id="f-data" /></div>
    <div class="field"><label>Local</label><input type="text" id="f-local" placeholder="Ex.: escritório, unidade..." /></div>
    <div class="field"><label>Setor / departamento</label><input type="text" id="f-setor" /></div>

    <div class="field">
      <label>Seu vínculo com a empresa <span class="req">*</span></label>
      <select id="f-vinculo">
        <option value="" disabled selected>Selecione uma opção</option>
        <option value="clt">CLT</option>
        <option value="terceirizado">Terceirizado</option>
        <option value="pj">PJ / Autônomo</option>
        <option value="estagiario">Estagiário</option>
        <option value="cliente_fornecedor">Cliente / Fornecedor</option>
        <option value="outro">Outro</option>
      </select>
    </div>

    <div class="field">
      <label>Isso aconteceu com você ou você está relatando algo envolvendo outra pessoa? <span class="req">*</span></label>
      <select id="f-sobre-quem">
        <option value="" disabled selected>Selecione uma opção</option>
        <option value="comigo">Aconteceu comigo</option>
        <option value="outra_pessoa">Estou relatando sobre outra pessoa</option>
      </select>
    </div>

    <div class="field">
      <label>Isso já aconteceu antes? Quantas vezes, aproximadamente? <span class="req">*</span></label>
      <input type="text" id="f-recorrencia" placeholder="Ex.: primeira vez, 2 vezes, diversas vezes..." />
    </div>

    <div class="field">
      <label>Relação hierárquica entre você e a pessoa denunciada <span class="req">*</span></label>
      <select id="f-hierarquia">
        <option value="" disabled selected>Selecione uma opção</option>
        <option value="superior">A pessoa denunciada é superior hierárquico</option>
        <option value="mesmo_nivel">Mesmo nível hierárquico</option>
        <option value="subordinado">A pessoa denunciada é subordinada a mim</option>
      </select>
    </div>

    <div class="field"><label>Pessoas envolvidas (opcional)</label><textarea id="f-envolvidos"></textarea></div>
    <div class="field"><label>Testemunhas (opcional)</label><textarea id="f-testemunhas"></textarea></div>
    <div class="field"><label>Descrição de provas</label><textarea id="f-provas"></textarea></div>

    <div class="field">
      <label>Anexos (fotos, documentos) — limite total ${formatBytes(MAX_ANEXOS_BYTES)}</label>
      <input type="file" id="f-files" multiple />
      <div id="file-error" style="color:var(--danger);font-size:11px;margin-top:6px"></div>
      <div id="file-list" style="margin-top:8px"></div>
    </div>

    <div class="field">
      <label>Identificação</label>
      <label class="checkbox-row" style="margin-bottom:6px">
        <input type="radio" name="anon" id="f-anon-sim" checked /> Prefiro não me identificar (anônimo)
      </label>
      <label class="checkbox-row">
        <input type="radio" name="anon" id="f-anon-nao" /> Quero me identificar
      </label>
      <input type="text" id="f-contato" placeholder="Nome e contato" style="margin-top:8px;display:none" />
    </div>

    <div class="field">
      <label class="checkbox-row">
        <input type="checkbox" id="f-consent" />
        Li e concordo com o tratamento dos meus dados pessoais para fins de apuração desta denúncia, nos termos da LGPD.
      </label>
    </div>

    <div id="form-error" class="alert error" style="display:none"></div>
    <button class="btn" id="btn-enviar">Enviar denúncia</button>
  `;
  viewContainer.appendChild(el);

  el.querySelectorAll(".cat-btn").forEach((btn) => {
    btn.onclick = () => {
      novaForm.categoria = btn.dataset.cat;
      el.querySelectorAll(".cat-btn").forEach((b) => b.classList.toggle("active", b === btn));
    };
  });

  el.querySelector("#f-anon-sim").onchange = () => {
    novaForm.anonimo = true;
    el.querySelector("#f-contato").style.display = "none";
  };
  el.querySelector("#f-anon-nao").onchange = () => {
    novaForm.anonimo = false;
    el.querySelector("#f-contato").style.display = "block";
  };

  const fileListEl = el.querySelector("#file-list");
  const fileErrorEl = el.querySelector("#file-error");
  function renderFileList() {
    fileListEl.innerHTML = novaForm.anexos.map((a, i) => `
      <div class="file-chip">
        <span>${esc(a.nome)} — ${formatBytes(a.tamanho)}</span>
        <button type="button" data-i="${i}" class="link-btn" style="margin:0">remover</button>
      </div>`).join("");
    fileListEl.querySelectorAll("button[data-i]").forEach((b) => {
      b.onclick = () => { novaForm.anexos.splice(Number(b.dataset.i), 1); renderFileList(); };
    });
  }

  el.querySelector("#f-files").onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    fileErrorEl.textContent = "";
    let total = novaForm.anexos.reduce((s, a) => s + a.tamanho, 0);
    for (const f of files) {
      let dataUrl, tamanho, tipo;
      try {
        if (f.type.startsWith("image/")) {
          dataUrl = await compressImageFile(f);
          tamanho = dataUrlSizeBytes(dataUrl);
          tipo = "image/jpeg";
        } else {
          dataUrl = await readFileAsDataURL(f);
          tamanho = f.size;
          tipo = f.type || "application/octet-stream";
        }
      } catch {
        fileErrorEl.textContent = `Não foi possível processar o arquivo "${f.name}".`;
        continue;
      }
      if (total + tamanho > MAX_ANEXOS_BYTES) {
        fileErrorEl.textContent = `O total de arquivos excede o limite de ${formatBytes(MAX_ANEXOS_BYTES)}. "${f.name}" não foi anexado.`;
        continue;
      }
      novaForm.anexos.push({ nome: f.name, tipo, tamanho, dataUrl });
      total += tamanho;
    }
    e.target.value = "";
    renderFileList();
  };

  el.querySelector("#btn-enviar").onclick = async () => {
    novaForm.relato = el.querySelector("#f-relato").value;
    novaForm.dataFato = el.querySelector("#f-data").value;
    novaForm.local = el.querySelector("#f-local").value;
    novaForm.setor = el.querySelector("#f-setor").value.trim();
    novaForm.vinculo = el.querySelector("#f-vinculo").value;
    novaForm.sobreQuem = el.querySelector("#f-sobre-quem").value;
    novaForm.recorrencia = el.querySelector("#f-recorrencia").value.trim();
    novaForm.hierarquia = el.querySelector("#f-hierarquia").value;
    novaForm.envolvidos = el.querySelector("#f-envolvidos").value;
    novaForm.testemunhas = el.querySelector("#f-testemunhas").value;
    novaForm.provasDescricao = el.querySelector("#f-provas").value;
    novaForm.contato = novaForm.anonimo ? "" : el.querySelector("#f-contato").value;
    novaForm.consent = el.querySelector("#f-consent").checked;

    const errEl = el.querySelector("#form-error");
    const valid = novaForm.categoria && novaForm.relato.trim().length >= 20 && novaForm.consent
      && novaForm.vinculo && novaForm.sobreQuem && novaForm.recorrencia.trim() && novaForm.hierarquia;
    if (!valid) {
      errEl.style.display = "flex";
      errEl.textContent = "Preencha a categoria, o relato (mín. 20 caracteres), vínculo, se aconteceu com você ou outra pessoa, recorrência, relação hierárquica, e aceite o termo de tratamento de dados.";
      return;
    }
    errEl.style.display = "none";

    const btn = el.querySelector("#btn-enviar");
    btn.disabled = true;
    btn.textContent = "Enviando...";

    const protocol = genProtocol(state.slug);
    const denuncia = {
      protocolo: protocol,
      empresa: state.slug,
      categoria: novaForm.categoria,
      relato: novaForm.relato,
      dataFato: novaForm.dataFato,
      local: novaForm.local,
      setor: novaForm.setor,
      vinculo: novaForm.vinculo,
      sobreQuem: novaForm.sobreQuem,
      recorrencia: novaForm.recorrencia,
      hierarquia: novaForm.hierarquia,
      envolvidos: novaForm.envolvidos,
      testemunhas: novaForm.testemunhas,
      provasDescricao: novaForm.provasDescricao,
      anexos: novaForm.anexos,
      anonimo: novaForm.anonimo,
      contato: novaForm.contato,
      status: "recebida",
      resultado: "",
      historico: [{ status: "recebida", em: new Date().toISOString() }],
      mensagens: [{ de: "comite", texto: AUTO_MESSAGES.recebida, em: new Date().toISOString() }],
      criadoEm: new Date().toISOString(),
    };

    const ok = await storageSet(`denuncia:${state.slug}:${protocol}`, denuncia);
    if (!ok) {
      errEl.style.display = "flex";
      errEl.textContent = novaForm.anexos.length
        ? "Não foi possível registrar a denúncia agora. Tente remover algum arquivo anexado ou reduzir o tamanho e envie novamente."
        : "Não foi possível registrar a denúncia agora. Tente novamente em instantes.";
      btn.disabled = false;
      btn.textContent = "Enviar denúncia";
      return;
    }

    state.lastProtocol = protocol;
    goto("protocolo");
  };
}

/* =========================================================
   TELA: Protocolo gerado
   ========================================================= */
function renderProtocoloGerado() {
  const el = document.createElement("div");
  el.className = "view protocol-box";
  el.innerHTML = `
    <h2>Denúncia registrada</h2>
    <p class="subtitle">Guarde este número de protocolo com cuidado.</p>
    <div class="card">
      <div style="font-size:11px;letter-spacing:1px;color:var(--ink-muted)">NÚMERO DE PROTOCOLO</div>
      <div class="protocol-code">${esc(state.lastProtocol)}</div>
      <button class="btn ghost" id="btn-copy">Copiar protocolo</button>
    </div>
    <div class="alert warn">
      Se você optou por não se identificar, este é o <b>único</b> meio de acompanhar sua denúncia. Não há como recuperá-lo caso seja perdido.
    </div>
    <button class="btn" id="btn-acompanhar-agora">Acompanhar esta denúncia →</button>
    <button class="link-btn" id="btn-inicio">Voltar ao início</button>
  `;
  viewContainer.appendChild(el);
  el.querySelector("#btn-copy").onclick = (e) => {
    navigator.clipboard?.writeText(state.lastProtocol);
    e.target.textContent = "Copiado";
    setTimeout(() => (e.target.textContent = "Copiar protocolo"), 1800);
  };
  el.querySelector("#btn-acompanhar-agora").onclick = () => goto("acompanhar");
  el.querySelector("#btn-inicio").onclick = () => goto("home");
}

/* =========================================================
   TELA: Acompanhar
   ========================================================= */
function renderTimeline(status) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  return `<div class="timeline">
    ${STATUS_STEPS.map((s, i) => `
      ${i > 0 ? `<div class="tl-line ${i <= currentIdx ? "done" : ""}"></div>` : ""}
      <div class="tl-step">
        <div class="tl-dot ${i <= currentIdx ? "done" : ""}">${i <= currentIdx ? "✓" : ""}</div>
        <div class="tl-label">${STATUS_LABEL[s]}</div>
      </div>
    `).join("")}
  </div>`;
}

function renderMensagens(mensagens) {
  if (!mensagens.length) return `<p style="font-size:12px;color:var(--ink-muted)">Nenhuma mensagem trocada ainda.</p>`;
  return mensagens.map((m) => `
    <div class="msg ${m.de === "comite" ? "comite" : "denunciante"}">
      <div class="who">${m.de === "comite" ? "Comitê de apuração" : "Você"}</div>
      <div>${esc(m.texto)}</div>
    </div>`).join("");
}

function renderAcompanhar() {
  const el = document.createElement("div");
  el.className = "view";
  el.innerHTML = `
    <h2>Acompanhar denúncia</h2>
    <p class="subtitle">Informe o número de protocolo recebido no registro.</p>
    <div class="flex-row" style="margin-bottom:16px">
      <input type="text" id="f-protocol" placeholder="Ex.: DEM-2607-483920" style="font-family:monospace" />
      <button class="btn small" id="btn-buscar">Buscar</button>
    </div>
    <div id="acompanhar-result"></div>
  `;
  viewContainer.appendChild(el);

  const resultEl = el.querySelector("#acompanhar-result");
  const input = el.querySelector("#f-protocol");

  async function buscar() {
    const protocolo = input.value.trim().toUpperCase();
    if (!protocolo) return;
    resultEl.innerHTML = `<p style="font-size:12px;color:var(--ink-muted)">Buscando...</p>`;
    const d = await storageGet(`denuncia:${state.slug}:${protocolo}`);
    if (!d) {
      resultEl.innerHTML = `<div class="alert error">Nenhuma denúncia encontrada com esse protocolo.</div>`;
      return;
    }
    state.acompanharDenuncia = d;
    renderDenunciaAcompanhamento();
  }

  function renderDenunciaAcompanhamento() {
    const d = state.acompanharDenuncia;
    const cat = CATEGORY_DEFS.find((c) => c.id === d.categoria);
    resultEl.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span class="tag" style="background:${cat?.color}22;color:${cat?.color}">${esc(cat?.label || d.categoria)}</span>
          <span style="font-family:monospace;font-size:11px;color:var(--ink-muted)">${esc(d.protocolo)}</span>
        </div>
        ${renderTimeline(d.status)}
        <div style="font-size:12px;font-weight:600;color:var(--ink-muted);margin-bottom:8px">MENSAGENS</div>
        <div id="msgs-box" style="max-height:220px;overflow-y:auto;margin-bottom:12px">${renderMensagens(d.mensagens)}</div>
        <div class="flex-row">
          <input type="text" id="f-msg" placeholder="Escrever mensagem..." />
          <button class="btn small" id="btn-enviar-msg">Enviar</button>
        </div>
      </div>
    `;
    resultEl.querySelector("#btn-enviar-msg").onclick = async () => {
      const msgInput = resultEl.querySelector("#f-msg");
      const texto = msgInput.value.trim();
      if (!texto) return;
      const updated = { ...d, mensagens: [...d.mensagens, { de: "denunciante", texto, em: new Date().toISOString() }] };
      await storageSet(`denuncia:${state.slug}:${d.protocolo}`, updated);
      state.acompanharDenuncia = updated;
      renderDenunciaAcompanhamento();
    };
  }

  el.querySelector("#btn-buscar").onclick = buscar;
  input.addEventListener("keydown", (e) => e.key === "Enter" && buscar());
}

/* =========================================================
   TELA: Login do comitê (autenticação real via Supabase Auth)
   ========================================================= */
function renderAdminLogin() {
  const el = document.createElement("div");
  el.className = "view";
  el.style.textAlign = "center";
  el.innerHTML = `
    <h2>Área do comitê</h2>
    <p class="subtitle">Acesso restrito a pessoas autorizadas da ${esc(state.tenant.name)}.</p>
    <div class="field"><input type="email" id="f-email" placeholder="E-mail" /></div>
    <div class="field"><input type="password" id="f-pass" placeholder="Senha de acesso" /></div>
    <div id="login-error" class="alert error" style="display:none"></div>
    <div id="login-info" class="alert" style="display:none;background:#E4EEE6;color:#2A5A3A"></div>
    <button class="btn" id="btn-login">Entrar</button>
    <button class="link-btn" id="btn-esqueci">Esqueci minha senha</button>
  `;
  viewContainer.appendChild(el);

  const errEl = el.querySelector("#login-error");
  const infoEl = el.querySelector("#login-info");
  async function submit() {
    const email = el.querySelector("#f-email").value.trim();
    const password = el.querySelector("#f-pass").value;
    const btn = el.querySelector("#btn-login");
    btn.disabled = true;
    btn.textContent = "Entrando...";
    errEl.style.display = "none";

    const { data, error: authError } = await sb.auth.signInWithPassword({ email, password });
    if (authError || !data.user) {
      errEl.style.display = "flex";
      errEl.textContent = "E-mail ou senha incorretos.";
      btn.disabled = false;
      btn.textContent = "Entrar";
      return;
    }
    const { data: isAdmin } = await sb.rpc("is_authorized_admin", { p_slug: state.slug });
    if (!isAdmin) {
      errEl.style.display = "flex";
      errEl.textContent = "Este usuário não tem acesso a este canal.";
      await sb.auth.signOut();
      btn.disabled = false;
      btn.textContent = "Entrar";
      return;
    }
    const { data: isSuper } = await sb.rpc("is_super_admin");
    state.isSuperAdmin = !!isSuper;
    state.adminViewSlug = state.slug;
    state.adminViewTenantName = state.tenant.name;
    state.adminOk = true;
    goto("admin");
  }
  el.querySelector("#btn-login").onclick = submit;
  el.querySelector("#f-pass").addEventListener("keydown", (e) => e.key === "Enter" && submit());

  el.querySelector("#btn-esqueci").onclick = async () => {
    const email = el.querySelector("#f-email").value.trim();
    errEl.style.display = "none";
    infoEl.style.display = "none";
    if (!email) {
      errEl.style.display = "flex";
      errEl.textContent = "Digite seu e-mail no campo acima e clique em \"Esqueci minha senha\" de novo.";
      return;
    }
    const redirectTo = window.location.origin + window.location.pathname + "?empresa=" + encodeURIComponent(state.slug);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    infoEl.style.display = "flex";
    infoEl.textContent = error
      ? "Não foi possível enviar o e-mail agora. Tente novamente em instantes."
      : "Se esse e-mail estiver cadastrado, enviamos um link para redefinir a senha.";
  };
}

/* =========================================================
   TELA: Redefinir senha (acessada pelo link recebido por e-mail)
   ========================================================= */
function renderResetSenha() {
  const el = document.createElement("div");
  el.className = "view";
  el.style.textAlign = "center";
  el.innerHTML = `
    <h2>Definir nova senha</h2>
    <p class="subtitle">Escolha uma nova senha de acesso para a área do comitê.</p>
    <div id="reset-loading" style="color:var(--ink-muted);font-size:13px;margin-bottom:12px">Confirmando o link, um instante...</div>
    <div id="reset-form" style="display:none">
      <div class="field"><input type="password" id="f-nova" placeholder="Nova senha (mínimo 6 caracteres)" /></div>
      <div class="field"><input type="password" id="f-nova2" placeholder="Confirme a nova senha" /></div>
      <button class="btn" id="btn-salvar-senha">Salvar nova senha</button>
    </div>
    <div id="reset-error" class="alert error" style="display:none"></div>
    <div id="reset-ok" class="alert" style="display:none;background:#E4EEE6;color:#2A5A3A"></div>
  `;
  viewContainer.appendChild(el);

  const errEl = el.querySelector("#reset-error");
  const okEl = el.querySelector("#reset-ok");
  const loadingEl = el.querySelector("#reset-loading");
  const formEl = el.querySelector("#reset-form");

  waitForRecoverySession().then((ready) => {
    loadingEl.style.display = "none";
    if (!ready) {
      errEl.style.display = "flex";
      errEl.textContent = "Este link expirou ou já foi usado. Volte à tela de login e solicite \"Esqueci minha senha\" novamente.";
      return;
    }
    formEl.style.display = "block";
  });

  el.querySelector("#btn-salvar-senha").onclick = async () => {
    const p1 = el.querySelector("#f-nova").value;
    const p2 = el.querySelector("#f-nova2").value;
    errEl.style.display = "none";
    if (p1.length < 6) {
      errEl.style.display = "flex";
      errEl.textContent = "A senha precisa ter pelo menos 6 caracteres.";
      return;
    }
    if (p1 !== p2) {
      errEl.style.display = "flex";
      errEl.textContent = "As duas senhas digitadas não são iguais.";
      return;
    }
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) {
      errEl.style.display = "flex";
      errEl.textContent = "O link pode ter expirado. Solicite \"Esqueci minha senha\" novamente.";
      return;
    }
    okEl.style.display = "flex";
    okEl.textContent = "Senha atualizada! Você já pode entrar com a nova senha.";
    setTimeout(() => { window.location.hash = ""; goto("admin-login"); }, 1800);
  };
}

/* =========================================================
   TELA: Painel do comitê de apuração
   ========================================================= */
async function loadAdminList() {
  const idx = (await storageGet(`denuncias-index:${state.adminViewSlug}`)) || [];
  const items = [];
  for (const p of idx) {
    const d = await storageGet(`denuncia:${state.adminViewSlug}:${p}`);
    if (d) items.push(d);
  }
  state.adminList = items;
}

function renderAdminPanel() {
  const el = document.createElement("div");
  el.className = "view wide-max";
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <h2 style="margin:0">Painel do comitê</h2>
        ${state.isSuperAdmin ? `<p class="subtitle" style="margin:2px 0 0">Visualizando: <b>${esc(state.adminViewTenantName)}</b> (${esc(state.adminViewSlug)})</p>` : ""}
      </div>
      <button class="link-btn" id="btn-sair" style="margin:0">Sair</button>
    </div>
    <div class="admin-tabs">
      ${state.isSuperAdmin ? `<div class="admin-tab ${state.adminTab === "empresas" ? "active" : ""}" data-tab="empresas">Empresas</div>` : ""}
      <div class="admin-tab ${state.adminTab === "lista" ? "active" : ""}" data-tab="lista">Denúncias</div>
      <div class="admin-tab ${state.adminTab === "dashboard" ? "active" : ""}" data-tab="dashboard">Dashboard</div>
    </div>
    <div id="admin-content">Carregando...</div>
  `;
  viewContainer.appendChild(el);

  el.querySelector("#btn-sair").onclick = async () => {
    await sb.auth.signOut();
    state.adminOk = false;
    state.adminSelected = null;
    goto("home");
  };
  el.querySelectorAll(".admin-tab").forEach((t) => {
    t.onclick = () => { state.adminTab = t.dataset.tab; state.adminSelected = null; render(); };
  });

  const contentEl = el.querySelector("#admin-content");
  if (state.adminTab === "empresas") {
    renderEmpresas(contentEl);
    return;
  }
  loadAdminList().then(() => {
    if (state.adminSelected) renderDenunciaDetalhe(contentEl);
    else if (state.adminTab === "dashboard") renderDashboard(contentEl);
    else renderListaDenuncias(contentEl);
  });
}

async function renderEmpresas(contentEl) {
  contentEl.innerHTML = `<p style="color:var(--ink-muted);font-size:13px">Carregando empresas...</p>`;
  const { data, error } = await sb.rpc("super_list_tenants");
  if (error || !data) {
    contentEl.innerHTML = `<div class="alert error">Não foi possível carregar a lista de empresas.</div>`;
    return;
  }
  contentEl.innerHTML = `
    <table class="list">
      <thead><tr><th>Empresa</th><th>Slug</th><th>Denúncias</th></tr></thead>
      <tbody>
        ${data.map((t) => `<tr data-slug="${esc(t.slug)}" data-name="${esc(t.name || t.slug)}">
          <td>${esc(t.name || t.slug)}</td>
          <td style="font-family:monospace">${esc(t.slug)}</td>
          <td>${t.total}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  `;
  contentEl.querySelectorAll("tr[data-slug]").forEach((tr) => {
    tr.onclick = () => {
      state.adminViewSlug = tr.dataset.slug;
      state.adminViewTenantName = tr.dataset.name;
      state.adminTab = "lista";
      state.adminSelected = null;
      render();
    };
  });
}

function renderListaDenuncias(contentEl) {
  const list = state.adminList;
  contentEl.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button class="btn small ghost" id="btn-export-consolidado">Exportar relatório consolidado (PDF)</button>
    </div>
    ${list.length === 0 ? `<p style="color:var(--ink-muted);font-size:13px">Nenhuma denúncia registrada ainda.</p>` : `
    <table class="list">
      <thead><tr><th>Protocolo</th><th>Categoria</th><th>Setor</th><th>Fase</th><th>Recebida em</th></tr></thead>
      <tbody>
        ${list.map((d) => {
          const cat = CATEGORY_DEFS.find((c) => c.id === d.categoria);
          return `<tr data-p="${esc(d.protocolo)}">
            <td style="font-family:monospace">${esc(d.protocolo)}</td>
            <td>${esc(cat?.label || d.categoria)}</td>
            <td>${esc(d.setor || "Não informado")}</td>
            <td>${STATUS_LABEL[d.status]}</td>
            <td>${formatDateTime(d.criadoEm)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`}
  `;
  contentEl.querySelectorAll("tr[data-p]").forEach((tr) => {
    tr.onclick = () => {
      state.adminSelected = state.adminList.find((d) => d.protocolo === tr.dataset.p);
      render();
    };
  });
  contentEl.querySelector("#btn-export-consolidado").onclick = () => exportConsolidado(list);
}

let dashPeriod = { tipo: "todos", de: "", ate: "" };

function filterByPeriod(list) {
  if (dashPeriod.tipo === "todos") return list;
  const now = new Date();
  let de = null, ate = null;
  if (dashPeriod.tipo === "7d") { de = new Date(now); de.setDate(de.getDate() - 7); }
  else if (dashPeriod.tipo === "30d") { de = new Date(now); de.setDate(de.getDate() - 30); }
  else if (dashPeriod.tipo === "ano") { de = new Date(now.getFullYear(), 0, 1); }
  else if (dashPeriod.tipo === "custom") {
    de = dashPeriod.de ? new Date(dashPeriod.de) : null;
    ate = dashPeriod.ate ? new Date(dashPeriod.ate + "T23:59:59") : null;
  }
  return list.filter((d) => {
    const t = new Date(d.criadoEm);
    if (de && t < de) return false;
    if (ate && t > ate) return false;
    return true;
  });
}

function renderDashboard(contentEl) {
  const fullList = state.adminList;
  const list = filterByPeriod(fullList);
  const byCat = {}, byFase = {}, bySetor = {}, byResultado = {};
  list.forEach((d) => {
    byCat[d.categoria] = (byCat[d.categoria] || 0) + 1;
    byFase[d.status] = (byFase[d.status] || 0) + 1;
    const s = d.setor || "Não informado";
    bySetor[s] = (bySetor[s] || 0) + 1;
    if (d.resultado) byResultado[d.resultado] = (byResultado[d.resultado] || 0) + 1;
  });

  const barColors = ["#A4823E", "#5B7DA6", "#8B5A83", "#6E7482", "#B2453A", "#4E9375"];
  function barBlock(title, obj, labelFn) {
    const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    const total = list.length || 1;
    if (!entries.length) return `<div class="stat-card"><div class="l">${title}</div><div style="font-size:11px;color:var(--ink-muted);margin-top:6px">Sem dados no período</div></div>`;
    return `<div class="stat-card">
      <div class="l" style="margin-bottom:10px">${title}</div>
      ${entries.map(([k, v], i) => {
        const pct = Math.round((v / total) * 100);
        return `
        <div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
            <span>${esc(labelFn(k))}</span><b>${v} <span style="color:var(--ink-muted);font-weight:400">(${pct}%)</span></b>
          </div>
          <div style="background:#00000010;border-radius:6px;height:8px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${barColors[i % barColors.length]}"></div>
          </div>
        </div>`;
      }).join("")}
    </div>`;
  }

  contentEl.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="l" style="font-size:12px;font-weight:600;margin-bottom:8px">Período</div>
      <div class="flex-row" style="flex-wrap:wrap;gap:6px">
        <button class="btn small ${dashPeriod.tipo === "todos" ? "" : "ghost"}" data-p="todos">Todos</button>
        <button class="btn small ${dashPeriod.tipo === "7d" ? "" : "ghost"}" data-p="7d">Últimos 7 dias</button>
        <button class="btn small ${dashPeriod.tipo === "30d" ? "" : "ghost"}" data-p="30d">Últimos 30 dias</button>
        <button class="btn small ${dashPeriod.tipo === "ano" ? "" : "ghost"}" data-p="ano">Este ano</button>
        <button class="btn small ${dashPeriod.tipo === "custom" ? "" : "ghost"}" data-p="custom">Personalizado</button>
      </div>
      ${dashPeriod.tipo === "custom" ? `
        <div class="flex-row" style="margin-top:10px">
          <input type="date" id="f-dash-de" value="${dashPeriod.de}" />
          <input type="date" id="f-dash-ate" value="${dashPeriod.ate}" />
        </div>` : ""}
    </div>

    <div class="dash-grid">
      <div class="stat-card"><div class="n">${list.length}</div><div class="l">Denúncias no período</div></div>
      <div class="stat-card"><div class="n">${list.filter((d) => d.status === "concluida").length}</div><div class="l">Concluídas no período</div></div>
    </div>
    <div class="dash-grid">
      ${barBlock("Por categoria", byCat, (k) => CATEGORY_DEFS.find((c) => c.id === k)?.label || k)}
      ${barBlock("Por fase", byFase, (k) => STATUS_LABEL[k] || k)}
      ${barBlock("Por setor", bySetor, (k) => k)}
      ${barBlock("Por resultado (concluídas)", byResultado, (k) => RESULTADO_OPTIONS.find((r) => r.id === k)?.label || k)}
    </div>
  `;

  contentEl.querySelectorAll("button[data-p]").forEach((b) => {
    b.onclick = () => { dashPeriod.tipo = b.dataset.p; renderDashboard(contentEl); };
  });
  const deInput = contentEl.querySelector("#f-dash-de");
  const ateInput = contentEl.querySelector("#f-dash-ate");
  if (deInput) deInput.onchange = () => { dashPeriod.de = deInput.value; renderDashboard(contentEl); };
  if (ateInput) ateInput.onchange = () => { dashPeriod.ate = ateInput.value; renderDashboard(contentEl); };
}

function renderDenunciaDetalhe(contentEl) {
  const d = state.adminSelected;
  const cat = CATEGORY_DEFS.find((c) => c.id === d.categoria);
  contentEl.innerHTML = `
    <button class="link-btn" id="btn-voltar-lista" style="margin:0 0 12px">← Voltar à lista</button>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span class="tag" style="background:${cat?.color}22;color:${cat?.color}">${esc(cat?.label || d.categoria)}</span>
        <span style="font-family:monospace;font-size:11px;color:var(--ink-muted)">${esc(d.protocolo)}</span>
      </div>
      <p style="font-size:12px;color:var(--ink-muted);margin-bottom:2px">Relato</p>
      <p style="font-size:13px;margin-bottom:12px">${esc(d.relato)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:12px">
        <div><b>Data do fato:</b> ${esc(d.dataFato || "—")}</div>
        <div><b>Local:</b> ${esc(d.local || "—")}</div>
        <div><b>Setor:</b> ${esc(d.setor || "Não informado")}</div>
        <div><b>Identificação:</b> ${d.anonimo ? "Anônima" : esc(d.contato || "Identificado")}</div>
        <div><b>Vínculo com a empresa:</b> ${esc(VINCULO_LABEL[d.vinculo] || "Não informado")}</div>
        <div><b>Relato sobre:</b> ${esc(SOBRE_QUEM_LABEL[d.sobreQuem] || "Não informado")}</div>
        <div><b>Recorrência:</b> ${esc(d.recorrencia || "Não informado")}</div>
        <div><b>Hierarquia:</b> ${esc(HIERARQUIA_LABEL[d.hierarquia] || "Não informado")}</div>
      </div>
      ${d.envolvidos ? `<p style="font-size:12px"><b>Envolvidos:</b> ${esc(d.envolvidos)}</p>` : ""}
      ${d.testemunhas ? `<p style="font-size:12px"><b>Testemunhas:</b> ${esc(d.testemunhas)}</p>` : ""}
      ${d.anexos?.length ? `<p style="font-size:12px"><b>Anexos:</b> ${d.anexos.map((a) => esc(a.nome)).join(", ")}</p>` : ""}

      ${renderTimeline(d.status)}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
        ${STATUS_STEPS.map((s) => `<button class="btn small ${s === d.status ? "" : "ghost"}" data-status="${s}">${STATUS_LABEL[s]}</button>`).join("")}
      </div>

      <div id="conclusao-box"></div>

      <div style="font-size:12px;font-weight:600;color:var(--ink-muted);margin-bottom:8px">MENSAGENS</div>
      <div style="max-height:200px;overflow-y:auto;margin-bottom:12px">${renderMensagens(d.mensagens)}</div>
      <div class="flex-row" style="margin-bottom:16px">
        <input type="text" id="f-reply" placeholder="Escrever mensagem..." />
        <button class="btn small" id="btn-reply">Enviar</button>
      </div>

      <button class="btn ghost small" id="btn-export-individual">Exportar esta denúncia (PDF)</button>
    </div>
  `;

  contentEl.querySelector("#btn-voltar-lista").onclick = () => { state.adminSelected = null; render(); };

  async function persistUpdate(updated) {
    await storageSet(`denuncia:${state.adminViewSlug}:${updated.protocolo}`, updated);
    state.adminSelected = updated;
    state.adminList = state.adminList.map((x) => (x.protocolo === updated.protocolo ? updated : x));
    render();
  }

  contentEl.querySelectorAll("button[data-status]").forEach((btn) => {
    btn.onclick = () => {
      const newStatus = btn.dataset.status;
      if (newStatus === "concluida") {
        renderConclusaoForm(contentEl.querySelector("#conclusao-box"), d, persistUpdate);
        return;
      }
      const autoTexto = AUTO_MESSAGES[newStatus];
      const updated = {
        ...d,
        status: newStatus,
        historico: [...d.historico, { status: newStatus, em: new Date().toISOString() }],
        mensagens: autoTexto ? [...d.mensagens, { de: "comite", texto: autoTexto, em: new Date().toISOString(), automatica: true }] : d.mensagens,
      };
      persistUpdate(updated);
    };
  });

  contentEl.querySelector("#btn-reply").onclick = () => {
    const input = contentEl.querySelector("#f-reply");
    const texto = input.value.trim();
    if (!texto) return;
    const updated = { ...d, mensagens: [...d.mensagens, { de: "comite", texto, em: new Date().toISOString() }] };
    persistUpdate(updated);
  };

  contentEl.querySelector("#btn-export-individual").onclick = () => exportIndividual(d);
}

function renderConclusaoForm(box, d, persistUpdate) {
  box.innerHTML = `
    <div class="card" style="background:var(--surface2)">
      <p style="font-size:12px;font-weight:600;margin-bottom:8px">Concluir apuração</p>
      <div class="field">
        <label>Resultado interno (não é exibido ao denunciante) <span class="req">*</span></label>
        <select id="f-resultado">
          <option value="">Selecione...</option>
          ${RESULTADO_OPTIONS.map((r) => `<option value="${r.id}">${esc(r.label)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Resposta ao denunciante <span class="req">*</span></label>
        <select id="f-resposta">
          <option value="">Selecione...</option>
          ${RESPOSTAS_PADRAO.map((r) => `<option value="${r.id}">${esc(r.label)}</option>`).join("")}
        </select>
      </div>
      <button class="btn small" id="btn-confirmar-conclusao">Confirmar conclusão</button>
    </div>
  `;
  box.querySelector("#btn-confirmar-conclusao").onclick = () => {
    const resultado = box.querySelector("#f-resultado").value;
    const respostaId = box.querySelector("#f-resposta").value;
    if (!resultado || !respostaId) return;
    const respostaTexto = RESPOSTAS_PADRAO.find((r) => r.id === respostaId)?.texto || "";
    const updated = {
      ...d,
      status: "concluida",
      resultado,
      historico: [...d.historico, { status: "concluida", em: new Date().toISOString() }],
      mensagens: [...d.mensagens, { de: "comite", texto: respostaTexto, em: new Date().toISOString(), automatica: true }],
    };
    persistUpdate(updated);
  };
}

/* ---------- exportação em PDF (via impressão do navegador) ---------- */
async function exportIndividual(d) {
  const hash = await computeIntegrityCode({ protocolo: d.protocolo, status: d.status, criadoEm: d.criadoEm, relato: d.relato, mensagens: d.mensagens });
  const cat = CATEGORY_DEFS.find((c) => c.id === d.categoria);
  const w = window.open("", "_blank");
  w.document.write(`
    <html><head><title>Denúncia ${esc(d.protocolo)}</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;color:#2B1A1D}
    h1{font-size:18px}table{width:100%;border-collapse:collapse;margin:12px 0}
    td,th{border:1px solid #ccc;padding:6px;font-size:12px;text-align:left}
    .foot{margin-top:30px;font-size:10px;color:#888}</style></head><body>
    <h1>${esc(state.adminViewTenantName || state.tenant.name)} — Relatório de Denúncia</h1>
    <table>
      <tr><td><b>Protocolo</b></td><td>${esc(d.protocolo)}</td></tr>
      <tr><td><b>Categoria</b></td><td>${esc(cat?.label || d.categoria)}</td></tr>
      <tr><td><b>Setor</b></td><td>${esc(d.setor || "Não informado")}</td></tr>
      <tr><td><b>Data/Local</b></td><td>${esc(d.dataFato || "—")} — ${esc(d.local || "—")}</td></tr>
      <tr><td><b>Identificação</b></td><td>${d.anonimo ? "Anônima" : esc(d.contato || "Identificado")}</td></tr>
      <tr><td><b>Vínculo com a empresa</b></td><td>${esc(VINCULO_LABEL[d.vinculo] || "Não informado")}</td></tr>
      <tr><td><b>Relato sobre</b></td><td>${esc(SOBRE_QUEM_LABEL[d.sobreQuem] || "Não informado")}</td></tr>
      <tr><td><b>Recorrência</b></td><td>${esc(d.recorrencia || "Não informado")}</td></tr>
      <tr><td><b>Hierarquia denunciante/denunciado</b></td><td>${esc(HIERARQUIA_LABEL[d.hierarquia] || "Não informado")}</td></tr>
      <tr><td><b>Fase atual</b></td><td>${STATUS_LABEL[d.status]}</td></tr>
      <tr><td><b>Resultado interno</b></td><td>${esc(RESULTADO_OPTIONS.find((r) => r.id === d.resultado)?.label || "—")}</td></tr>
    </table>
    <h3>Relato integral</h3><p style="font-size:12px">${esc(d.relato)}</p>
    <h3>Envolvidos / testemunhas</h3><p style="font-size:12px">${esc(d.envolvidos || "—")} / ${esc(d.testemunhas || "—")}</p>
    <h3>Trilha de fases</h3>
    <table><tr><th>Fase</th><th>Data/hora</th></tr>
      ${d.historico.map((h) => `<tr><td>${STATUS_LABEL[h.status]}</td><td>${formatDateTime(h.em)}</td></tr>`).join("")}
    </table>
    <h3>Histórico de mensagens</h3>
    ${d.mensagens.map((m) => `<p style="font-size:12px"><b>${m.de === "comite" ? "Comitê" : "Denunciante"}</b> (${formatDateTime(m.em)}): ${esc(m.texto)}</p>`).join("")}
    ${d.anexos?.length ? `
      <h3>Anexos</h3>
      ${d.anexos.filter((a) => a.tipo?.startsWith("image/")).map((a) => `
        <p style="font-size:11px;margin-bottom:2px">${esc(a.nome)}</p>
        <img src="${a.dataUrl}" style="max-width:100%;max-height:400px;margin-bottom:14px;border:1px solid #ccc" />
      `).join("")}
      ${(() => {
        const outros = d.anexos.filter((a) => !a.tipo?.startsWith("image/"));
        return outros.length
          ? `<p style="font-size:12px"><b>Outros arquivos (não incorporáveis em PDF):</b> ${outros.map((a) => esc(a.nome)).join(", ")} — baixe o(s) arquivo(s) original(is) no painel e junte separadamente ao processo.</p>`
          : "";
      })()}
    ` : ""}
    <div class="foot">Gerado em ${formatDateTime(new Date().toISOString())} · Código de integridade (SHA-256, primeiros 32 caracteres): ${hash}</div>
    <script>window.onload = () => window.print();<\/script>
    </body></html>
  `);
  w.document.close();
}

async function exportConsolidado(list) {
  const hash = await computeIntegrityCode(list.map((d) => ({ protocolo: d.protocolo, status: d.status, resultado: d.resultado })));
  const w = window.open("", "_blank");
  w.document.write(`
    <html><head><title>Relatório consolidado</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;color:#2B1A1D}
    table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px;font-size:12px;text-align:left}
    .foot{margin-top:30px;font-size:10px;color:#888}</style></head><body>
    <h1>${esc(state.adminViewTenantName || state.tenant.name)} — Relatório Consolidado</h1>
    <table>
      <tr><th>Protocolo</th><th>Categoria</th><th>Setor</th><th>Fase</th><th>Resultado</th><th>Recebida em</th></tr>
      ${list.map((d) => `<tr>
        <td>${esc(d.protocolo)}</td>
        <td>${esc(CATEGORY_DEFS.find((c) => c.id === d.categoria)?.label || d.categoria)}</td>
        <td>${esc(d.setor || "Não informado")}</td>
        <td>${STATUS_LABEL[d.status]}</td>
        <td>${esc(RESULTADO_OPTIONS.find((r) => r.id === d.resultado)?.label || "—")}</td>
        <td>${formatDateTime(d.criadoEm)}</td>
      </tr>`).join("")}
    </table>
    <div class="foot">Gerado em ${formatDateTime(new Date().toISOString())} · Código de integridade (SHA-256, primeiros 32 caracteres): ${hash}</div>
    <script>window.onload = () => window.print();<\/script>
    </body></html>
  `);
  w.document.close();
}



