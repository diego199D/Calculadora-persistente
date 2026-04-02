const SUPABASE_URL = 'https://nxaqzhmojgydoyhpbzfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_S99rfoTFEw3IEWpRqdRdUg_RG_cES_D';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let habitacionActual = null;

async function cargarDatos() {
    const { data, error } = await _supabase.from('planillas').select('*');
    if (error || !data) return;

    const ocupadas = data.filter(p => p.estado === 'ocupada');
    const sucias = data.filter(p => p.estado === 'sucia');

    const lista = document.getElementById('lista-ocupadas');
    lista.innerHTML = `
        <div class="card-ocupada" style="font-weight:bold; background:#5a6eb1; color:white; border-radius:5px 5px 0 0">
            <div>PZA</div><div>ACCIONES</div><div>ENTRADA</div><div>A/C</div><div>PAGO</div>
        </div>`;
    
    ocupadas.forEach(p => {
        const horaE = new Date(p.entrada).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: true 
        }).toLowerCase();

        lista.innerHTML += `
            <div class="card-ocupada">
                <div><b>${p.nro_pieza}</b></div>
                <div>
                    <button class="btn-amarillo" onclick="abrirEditar('${p.id}', ${p.nro_pieza}, ${p.pago_adelantado}, ${p.ac})">Editar</button>
                    <button class="btn-verde" onclick="abrirCobro('${p.id}', '${p.entrada}', ${p.pago_adelantado}, ${p.ac}, ${p.nro_pieza})">Salida</button>
                </div>
                <div>${horaE}</div>
                <div>${p.ac ? 'SI' : 'NO'}</div>
                <div>${parseFloat(p.pago_adelantado).toFixed(2)}</div>
            </div>`;
    });

    document.getElementById('sucias').innerHTML = sucias.map(s => 
        `<div class="circulo sucia" onclick="liberar('${s.id}')">${s.nro_pieza}</div>`
    ).join('');
}

// --- LÓGICA DE EDICIÓN ---
function abrirEditar(id, nro, adelanto, ac) {
    document.getElementById('edit-nro').value = nro;
    document.getElementById('edit-adelanto').value = adelanto;
    document.getElementById('edit-ac').checked = ac;
    
    document.getElementById('modalEditar').showModal();
    
    document.getElementById('btnGuardarEdit').onclick = async () => {
        const nuevoNro = document.getElementById('edit-nro').value;
        const nuevoAdelanto = document.getElementById('edit-adelanto').value;
        const nuevoAc = document.getElementById('edit-ac').checked;

        await _supabase.from('planillas').update({
            nro_pieza: nuevoNro,
            pago_adelantado: nuevoAdelanto,
            ac: nuevoAc
        }).eq('id', id);

        document.getElementById('modalEditar').close();
        cargarDatos();
    };
}

// --- LÓGICA DE SALIDA (Tu Negocio) ---
function abrirCobro(id, entradaStr, adelanto, ac, nro) {
    habitacionActual = { id, entradaStr, adelanto, ac };
    const ahora = new Date();
    const offset = ahora.getTimezoneOffset() * 60000;
    const ahoraLocal = new Date(ahora - offset);
    
    document.getElementById('m-titulo').innerText = `Habitación ${nro}`;
    const entradaFormateada = new Date(entradaStr).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true 
    }).toLowerCase();

    document.getElementById('m-entrada').innerText = entradaFormateada;
    document.getElementById('m-input-salida').value = ahoraLocal.toISOString().slice(0, 16);
    document.getElementById('m-adelanto').innerText = `-${parseFloat(adelanto).toFixed(2)}`;

    document.getElementById('m-input-salida').onchange = recalcular;
    recalcular();
    document.getElementById('modalSalida').showModal();
    document.getElementById('btnDespachar').onclick = () => despachar(id);
}

function recalcular() {
    const { entradaStr, adelanto, ac } = habitacionActual;
    const entrada = new Date(entradaStr);
    const inputVal = document.getElementById('m-input-salida').value;
    const salida = inputVal ? new Date(inputVal) : new Date();

    let diffMin = Math.floor((salida - entrada) / 60000);
    if (diffMin < 0) diffMin = 0;
    
    let horas = Math.floor(diffMin / 60);
    let minutos = diffMin % 60;
    let costoHab = 0;

    if (ac == 1 || ac == true) {
        if (diffMin <= 76) costoHab = 35;
        else {
            costoHab = horas * 30;
            if (minutos >= 24) costoHab += 30;
            else if (minutos >= 17) costoHab += 15;
        }
    } else {
        if (horas === 0 && minutos === 0) costoHab = 0;
        else if (horas === 0) costoHab = 30;
        else {
            costoHab = 30 + (horas - 1) * 20;
            if (minutos >= 24) costoHab += 20;
            else if (minutos >= 17) costoHab += 10;
        }
    }

    const total = (costoHab - adelanto) < 0 ? 0 : (costoHab - adelanto);
    document.getElementById('m-tiempo').innerText = `${horas}h ${minutos}m`;
    document.getElementById('m-precio-hab').innerText = costoHab.toFixed(2);
    document.getElementById('m-total').innerText = total.toFixed(2);
}

async function despachar(id) {
    const total = document.getElementById('m-total').innerText;
    const salidaVal = document.getElementById('m-input-salida').value;
    await _supabase.from('planillas').update({ 
        estado: 'sucia', 
        salida: new Date(salidaVal).toISOString(), 
        monto_total: parseFloat(total)
    }).eq('id', id);
    cerrarModal();
    cargarDatos();
}

function cerrarModal() { document.getElementById('modalSalida').close(); }

async function registrarEntrada() {
    const nro = document.getElementById('nroPza').value;
    const adel = document.getElementById('adelanto').value || 0;
    const ac = document.getElementById('acCheck').checked;
    if(!nro) return alert("Pone el nro de pieza");
    await _supabase.from('planillas').insert([{ nro_pieza: nro, ac: ac, pago_adelantado: adel, estado: 'ocupada' }]);
    cargarDatos();
}

async function liberar(id) {
    await _supabase.from('planillas').delete().eq('id', id);
    cargarDatos();
}

document.addEventListener('DOMContentLoaded', cargarDatos);