let DATA = [];
let TECH_DATA = [];

const csvColumns = [
    'localidade', 'alta', 'baixa', 'media', 'total', 'requisicoes', 'incidentes',
    'nivel_alta', 'nivel_baixa', 'nivel_media',
    'glosa_alta', 'glosa_baixa', 'glosa_media', 'glosa_total',
    'solucionado', 'fechado', 'pendente', 'atendimento',
    'pesquisas', 'taxa_pesquisa', 'satisfacao', 'direto', 'email', 'telefone', 'helpdesk'
];

const csvAliases = {
    localidade: 'localidade',
    alta: 'alta',
    baixa: 'baixa',
    media: 'media',
    total: 'total',
    'chamados registrados': 'total',
    requisicoes: 'requisicoes',
    incidentes: 'incidentes',
    nivel_alta: 'nivel_alta',
    nivel_baixa: 'nivel_baixa',
    nivel_media: 'nivel_media',
    glosa_alta: 'glosa_alta',
    glosa_baixa: 'glosa_baixa',
    glosa_media: 'glosa_media',
    glosa_total: 'glosa_total',
    solucionado: 'solucionado',
    fechado: 'fechado',
    pendente: 'pendente',
    atendimento: 'atendimento',
    'em atendimento': 'atendimento',
    numero: 'pesquisas',
    pesquisas: 'pesquisas',
    percentual: 'taxa_pesquisa',
    satisfacao: 'satisfacao',
    direto: 'direto',
    'e-mail': 'email',
    email: 'email',
    telefone: 'telefone',
    helpdesk: 'helpdesk'
};

function normalizeCsvHeader(value) {
    return String(value ?? '')
        .replace(/\uFEFF/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function parseCsvValue(value) {
    if (typeof value !== 'string') return value;

    const normalized = value.trim().replace(/\s/g, '');
    if (!normalized) return null;

    const numberText = normalized.includes(',')
        ? normalized.replace(/\./g, '').replace(',', '.')
        : normalized.replace(/^(-?\d{1,3})(?:\.(\d{3}))+$/, value => value.replace(/\./g, ''));
    const number = Number(numberText);
    return Number.isFinite(number) ? number : value;
}

function parseCsvText(text) {
    let semicolonCount = 0;
    let commaCount = 0;
    let insideQuotes = false;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (character === '"') {
            if (insideQuotes && text[index + 1] === '"') {
                index++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (!insideQuotes && character === ';') {
            semicolonCount++;
        } else if (!insideQuotes && character === ',') {
            commaCount++;
        }
    }

    const delimiter = semicolonCount > commaCount ? ';' : ',';
    const rows = [];
    let row = [];
    let field = '';
    insideQuotes = false;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];

        if (insideQuotes) {
            if (character === '"' && text[index + 1] === '"') {
                field += '"';
                index++;
            } else if (character === '"') {
                insideQuotes = false;
            } else {
                field += character;
            }
        } else if (character === '"' && !field.trim()) {
            field = '';
            insideQuotes = true;
        } else if (character === delimiter) {
            row.push(field);
            field = '';
        } else if (character === '\r' || character === '\n') {
            row.push(field);
            if (row.some(value => value.trim())) rows.push(row);
            row = [];
            field = '';
            if (character === '\r' && text[index + 1] === '\n') index++;
        } else {
            field += character;
        }
    }

    if (insideQuotes) {
        throw new Error('Há um campo entre aspas que não foi fechado no CSV.');
    }

    row.push(field);
    if (row.some(value => value.trim())) rows.push(row);
    return rows;
}

function decodeCsvFile(file) {
    return file.arrayBuffer().then(buffer => {
        const bytes = new Uint8Array(buffer);

        if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
            return new TextDecoder('utf-16le').decode(buffer);
        }
        if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
            return new TextDecoder('utf-16be').decode(buffer);
        }

        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch (error) {
            if (!(error instanceof TypeError)) throw error;
            return new TextDecoder('windows-1252').decode(buffer);
        }
    });
}

function parseCsvRows(rows) {
    const headerLocation = rows.reduce((found, row, rowIndex) => {
        if (found) return found;
        const columnIndex = row.findIndex(value => normalizeCsvHeader(value) === 'localidade');
        return columnIndex < 0 ? null : { rowIndex, columnIndex };
    }, null);
    if (!headerLocation) {
        throw new Error('Não encontrei a coluna LOCALIDADE no CSV.');
    }

    const { rowIndex: headerIndex, columnIndex: localityIndex } = headerLocation;
    const headerRow = rows[headerIndex];
    const hasGroupedHeaders = normalizeCsvHeader(headerRow[localityIndex + 1]) === 'chamados registrados';
    let columns;
    let dataStart;

    if (hasGroupedHeaders) {
        columns = [...Array(localityIndex).fill(null), ...csvColumns];
        dataStart = headerIndex + 2;
    } else {
        columns = headerRow.map(header => csvAliases[normalizeCsvHeader(header)] || null);
        if (!columns.some(column => ['total', 'alta', 'media', 'baixa'].includes(column))) {
            throw new Error('O cabeçalho do CSV não contém as colunas esperadas de localidade e chamados.');
        }
        dataStart = headerIndex + 1;
    }

    const totalsIndex = rows.findIndex((row, index) =>
        index >= dataStart && normalizeCsvHeader(row[localityIndex]) === 'totais'
    );
    const dataEnd = totalsIndex < 0 ? rows.length : totalsIndex;

    return rows.slice(dataStart, dataEnd)
        .filter(row => normalizeCsvHeader(row[localityIndex]) !== '')
        .map(row => {
            const record = {};
            columns.forEach((column, index) => {
                if (column) record[column] = parseCsvValue(row[index]);
            });
            record.localidade = String(row[localityIndex]).trim();
            return record;
        });
}

function parseTechnicianRows(rows) {
    const totalsIndex = rows.findIndex(row =>
        normalizeCsvHeader(row[0]) === 'totais'
    );
    if (totalsIndex < 0) return [];

    const localityNamesByCode = {
        alm: 'Almirante Barroso',
        rb: 'Rio Branco',
        vz: 'Venezuela',
        na: 'Angra',
        bp: 'Barra do Piraí',
        ca: 'Campos',
        dc: 'Duque de Caxias',
        it: 'Itaboraí',
        ip: 'Itaperuna',
        mc: 'Macaé',
        ma: 'Magé',
        ni: 'Niterói',
        nf: 'Nova Friburgo',
        nig: 'Nova Iguaçu',
        pe: 'Petrópolis',
        re: 'Resende',
        sg: 'São Gonçalo',
        sj: 'São João de Meriti',
        sp: 'São Pedro da Aldeia',
        te: 'Teresópolis',
        tr: 'Três Rios',
        vr: 'Volta Redonda'
    };
    const technicians = new Map();
    let inTechnicianSection = false;
    let currentLocality = '';

    for (const row of rows.slice(totalsIndex + 1)) {
        const first = normalizeCsvHeader(row[0]);
        const second = normalizeCsvHeader(row[1]);
        const isTechnicianHeader = second === 'total'
            && normalizeCsvHeader(row[2]) === 'alta'
            && ['media', 'média'].includes(normalizeCsvHeader(row[3]));

        if (first.startsWith('localidades da ')) {
            inTechnicianSection = true;
            continue;
        }
        if (!inTechnicianSection) continue;
        if (isTechnicianHeader) {
            currentLocality = localityNamesByCode[first] || String(row[0]).trim();
            continue;
        }
        if (!row[0]) continue;

        const name = String(row[0]).trim();
        const total = parseCsvValue(row[1]);
        const high = parseCsvValue(row[2]);
        const medium = parseCsvValue(row[3]);
        const low = parseCsvValue(row[4]);

        if (
            !name
            || normalizeCsvHeader(name) === 'nao atribuido'
            || ![total, high, medium, low].every(Number.isFinite)
        ) {
            continue;
        }

        const key = normalizeCsvHeader(name);
        const current = technicians.get(key) || { nome: name, total: 0, alta: 0, media: 0, baixa: 0, localidades: [] };
        current.total += total;
        current.alta += high;
        current.media += medium;
        current.baixa += low;
        if (currentLocality && !current.localidades.includes(currentLocality)) {
            current.localidades.push(currentLocality);
        }
        technicians.set(key, current);
    }

    return [...technicians.values()];
}

document.getElementById('csvFile').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    event.target.value = '';

    const btnLabel = document.getElementById('fileBtnLabel');
    btnLabel.textContent = `📄 ${file.name}`;
    btnLabel.title = file.name;

    decodeCsvFile(file)
        .then(text => {
            const rawRows = parseCsvText(text);
            
            // 🌟 SOLUÇÃO DEFINITIVA: Lê a segunda linha e ignora os pontos e vírgulas vazios!
            let mesEncontrado = "Mês atual"; 
            
            // Verifica se a segunda linha (índice 1) existe
            if (rawRows.length > 1 && rawRows[1]) {
                // Pega na linha 2 e filtra apenas as células que têm texto escrito
                const celulasPreenchidas = rawRows[1].filter(celula => celula.trim() !== '');
                
                if (celulasPreenchidas.length > 0) {
                    // Se encontrar o mês e o ano (ex: "Outubro" e "2026"), junta os dois
                    if (celulasPreenchidas.length >= 2) {
                        mesEncontrado = `${celulasPreenchidas[0].trim()} de ${celulasPreenchidas[1].trim()}`;
                    } else {
                        // Se por acaso só tiver o mês
                        mesEncontrado = celulasPreenchidas[0].trim();
                    }
                }
            }

            // 1. Atualiza o texto ao lado de "Resumo Executivo"
            const indicador = document.getElementById('mesIndicador');
            if (indicador) indicador.textContent = `(${mesEncontrado})`;

            // 2. Atualiza o texto do subtítulo principal lá no topo
            const periodText = document.getElementById('period');
            if (periodText) periodText.innerHTML = `Competência: &nbsp;<strong>${mesEncontrado}</strong> `;

            // Continua com a leitura normal dos dados
            const importedData = parseCsvRows(rawRows);
            if (!importedData.length) {
                throw new Error('O CSV não contém linhas de dados após o cabeçalho.');
            }

            DATA = importedData;
            TECH_DATA = parseTechnicianRows(rawRows);
            loc.innerHTML = '<option value="__all">Todas as localidades</option>';
            DATA.forEach(row => {
                const option = document.createElement('option');
                option.value = row.localidade;
                option.textContent = row.localidade;
                loc.appendChild(option);
            });

            loc.value = '__all';
            render();
        })
        .catch(error => {
            alert('Não foi possível importar o CSV: ' + error.message);
        });
});