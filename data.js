let DATA = []; // Começa vazio

document.getElementById('csvFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,          
        dynamicTyping: true,   
        skipEmptyLines: true, 
        complete: function(results) {
            DATA = results.data;             
         
            loc.innerHTML = '<option value="__all">Todas as localidades</option>';
            DATA.forEach(d => { 
                const o = document.createElement('option'); 
                o.value = d.localidade; 
                o.textContent = d.localidade; 
                loc.appendChild(o); 
            });

            render(); 
            alert('Dados carregados com sucesso!');
        },
        error: function(err) {
            alert('Erro ao ler o ficheiro CSV: ' + err.message);
        }
    });
});