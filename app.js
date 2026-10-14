    const fmt = n => n === null || n === undefined || !Number.isFinite(Number(n)) ? 'sem dados' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    const pct = n => n === null || n === undefined || !Number.isFinite(Number(n)) ? 'sem dados' : (Number(n) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
    const labels = { total: 'Chamados registrados', alta: 'Prioridade alta', media: 'Prioridade média', baixa: 'Prioridade baixa', pendente: 'Pendentes', atendimento: 'Em atendimento', solucionado: 'Solucionados', fechado: 'Fechados', requisicoes: 'Requisições', incidentes: 'Incidentes', pesquisas: 'Pesquisas de satisfação', satisfacao: 'Média de satisfação', direto: 'Origem: direto', email: 'Origem: e-mail', telefone: 'Origem: telefone', helpdesk: 'Origem: helpdesk' };
    const priorityColors = ['#1E3A8A', '#3B82F6', '#93C5FD'];
    
    const loc = document.getElementById('locFilter'), metric = document.getElementById('metricFilter');
    DATA.forEach(d => { const o = document.createElement('option'); o.value = d.localidade; o.textContent = d.localidade; loc.appendChild(o); });
    
    const getNum = (d, k) => d[k] === null || d[k] === undefined || !Number.isFinite(Number(d[k])) ? null : Number(d[k]);
    function sum(arr, k) { const vals = arr.map(d => getNum(d, k)).filter(v => v !== null); return vals.length ? vals.reduce((a, b) => a + b, 0) : null; }
    function avg(arr, k) { const vals = arr.map(d => getNum(d, k)).filter(v => v !== null); return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null; }
    function active() { return DATA.filter(d => loc.value === '__all' || d.localidade === loc.value); }
    function card(label, value, foot, hero = false) { return `<article class="card ${hero ? 'hero' : ''}"><div class="klabel">${label}</div><div class="kvalue">${value}</div><div class="kfoot">${foot}</div></article>`; }

    function renderRankings(rows, key, title) {
        const localRank = [...rows]
            .filter(row => getNum(row, key) !== null)
            .sort((a, b) => getNum(b, key) - getNum(a, key))
            .slice(0, 5);
        const technicianKey = ['total', 'alta', 'media', 'baixa'].includes(key) ? key : 'total';
        const technicianRank = [...TECH_DATA]
            .sort((a, b) => b[technicianKey] - a[technicianKey])
            .slice(0, 5);
        const makeItems = (rank, getName, getValue) => rank.length
            ? rank.map((row, index) => `<div class="rank-item"><span class="r-name"><b>${index + 1}º</b> ${getName(row)}</span><strong class="r-val">${fmt(getValue(row))}</strong></div>`).join('')
            : '<div class="empty-state">Sem dados para este ranking</div>';

        document.getElementById('boxRankLoc').innerHTML = `
            <h3 class="chart-title">🏆 Top 5 Localidades</h3>
            <div class="chart-sub">Filtrado por ${title.toLowerCase()}</div>
            <div class="rank-list">${makeItems(localRank, row => row.localidade, row => getNum(row, key))}</div>
        `;
        document.getElementById('boxRankTech').innerHTML = `
            <h3 class="chart-title">🥇 Top 5 Técnicos</h3>
            <div class="chart-sub">Por ${labels[technicianKey].toLowerCase()} · geral</div>
            <div class="rank-list">${makeItems(technicianRank, row => row.nome, row => row[technicianKey])}</div>
        `;
    }
    
    function render() {
        const rows = active(), key = metric.value, title = labels[key] || key, total = sum(rows, key);
    
        document.getElementById('barTitle').textContent = title + ' por localidade';
        document.getElementById('barSub').textContent = 'Comparativo ordenado · ' + title.toLowerCase() + ' · escala iniciada em zero';
        
        const sorted = [...rows].sort((a, b) => (getNum(b, key) ?? -Infinity) - (getNum(a, key) ?? -Infinity));
        const valid = sorted.filter(d => getNum(d, key) !== null), top = valid.slice(0, 10), max = Math.max(0, ...top.map(d => getNum(d, key) || 0));
        
        document.getElementById('bars').innerHTML = top.length ? top.map((d, i) => `<div class="barrow"><div class="barlabel" title="${d.localidade}">${i === 0 ? '★ ' : ''}${d.localidade}</div><div class="track" role="img" aria-label="${d.localidade}: ${fmt(getNum(d, key))}"><div class="bar ${i === 0 ? 'top' : ''} ${i === top.length - 1 ? 'critical' : ''}" style="width:${max > 0 ? Math.max(0, (getNum(d, key) || 0) / max * 100) : 0}%"></div></div><div class="barval">${fmt(getNum(d, key))}</div></div>`).join('') : '<div class="empty-state">Sem dados para este filtro</div>';
        
        const pr = [{ k: 'alta', name: 'Alta', v: sum(rows, 'alta') }, { k: 'media', name: 'Média', v: sum(rows, 'media') }, { k: 'baixa', name: 'Baixa', v: sum(rows, 'baixa') }], ptotal = pr.every(x => x.v !== null) ? pr.reduce((a, x) => a + x.v, 0) : null;
        
        if (ptotal === null || ptotal === 0) { 
            document.getElementById('donutArea').innerHTML = '<div class="empty-state">Sem dados para este filtro</div>'; 
        } else { 
            let cursor = 0; 
            const stops = pr.map((x, i) => { const start = cursor; cursor += x.v / ptotal * 100; return `${priorityColors[i]} ${start}% ${cursor}%`; }).join(','); 
            document.getElementById('donutArea').innerHTML = `<div class="donutwrap"><div class="donut" style="background:conic-gradient(${stops})"><div class="donutcenter"><div class="donutnum">${fmt(ptotal)}</div><div class="donutlabel">chamados</div></div></div><div class="legend">${pr.map((x, i) => `<div class="legrow"><span class="swatch" style="background:\${priorityColors[i]}"></span><span class="legname">${x.name} ·${pct(x.v / ptotal)}</span><span class="legval">${fmt(x.v)}</span></div>`).join('')}</div></div>`; 
        }
        
        const high = sorted.find(d => getNum(d, key) !== null), low = [...sorted].reverse().find(d => getNum(d, key) !== null);
        const pShare = ptotal ? pr[0].v / ptotal : null;
        
        document.getElementById('insights').innerHTML =
            `<article class="insight"><div class="tag">Maior valor</div><p>${high ? `<strong> ${high.localidade}</strong> lidera em ${title.toLowerCase()} com <strong>${fmt(getNum(high, key))}</strong>.` : 'Sem dados para identificar liderança.'}</p></article>` +
            `<article class="insight critical"><div class="tag">Menor valor observado</div><p>${low ? `<strong>${low.localidade}</strong> apresenta o menor valor registrado: <strong>${fmt(getNum(low, key))}</strong>. Zero explícito não significa ausência de dado.` : 'Sem dados para identificar o menor valor.'}</p></article>` +
            `<article class="insight"><div class="tag">Prioridade alta</div><p>${pShare === null ? 'Sem dados para calcular a participação de prioridade alta.' : `Chamados de prioridade alta representam <strong>${pct(pShare)}</strong> do volume filtrado (${fmt(pr[0].v)} de${fmt(ptotal)}).`}</p></article>`;
            
        document.getElementById('countPill').textContent = rows.length + ' localidades';
        const sumDen = total;
        const columns = [['localidade', 'Localidade'], [key, title], ['participacao', 'Participação'], ['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa'], ['pendente', 'Pendente'], ['atendimento', 'Em atendimento'], ['pesquisas', 'Pesquisas'], ['satisfacao', 'Média satisfação']];
        
        document.getElementById('tableWrap').innerHTML = rows.length ? `<table><thead><tr>${columns.map(c => `<th style="${c[0] === 'localidade' ? 'text-align:left' : ''}">${c[1]}</th>`).join('')}</tr></thead><tbody>${sorted.map((d, i) => { const v = getNum(d, key), share = (sumDen && v !== null) ? v / sumDen : null; return `<tr class="\${i === 0 ? 'rank1' : ''}"><td>${i === 0 ? '<span class="rankbadge">#1</span>' : ''}${d.localidade}</td><td class="numcell">${fmt(v)}</td><td>${pct(share)}</td><td>${fmt(getNum(d, 'alta'))}</td><td>${fmt(getNum(d, 'media'))}</td><td>${fmt(getNum(d, 'baixa'))}</td><td>${fmt(getNum(d, 'pendente'))}</td><td>${fmt(getNum(d, 'atendimento'))}</td><td>${fmt(getNum(d, 'pesquisas'))}</td><td>${fmt(getNum(d, 'satisfacao'))}</td></tr>`; }).join('')}</tbody></table>` : '<div class="empty-state">Sem dados para este filtro</div>';
        renderRankings(rows, key, title);
    }
    
    loc.addEventListener('change', render);
    metric.addEventListener('change', render);
    document.getElementById('clearBtn').addEventListener('click', () => { loc.value = '__all'; metric.value = 'total'; render(); });
    render();

    // Lógica de Modo Escuro (Adaptada para JS Puro)
const themeToggle = document.getElementById('themeToggle');

// 1. Verifica se o utilizador já tinha uma preferência salva ou usa a do Sistema Operativo
const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const savedOverride = localStorage.getItem('colorSchemeOverride');

const isDarkActive = savedOverride === 'dark' || (!savedOverride && systemPrefersDark);

if (isDarkActive) {
    document.body.classList.add('dark-mode');
    themeToggle.textContent = '☀️ Modo Claro';
} else {
    themeToggle.textContent = '🌙 Modo Escuro';
}

// 2. Ação de clique para alternar o tema (equivalente ao toggleScheme)
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    
    // Atualiza o texto/ícone do botão
    themeToggle.textContent = isDark ? '☀️ Modo Claro' : '🌙 Modo Escuro';
    
    // Guarda a preferência no armazenamento local do navegador
    localStorage.setItem('colorSchemeOverride', isDark ? 'dark' : 'light');
});
