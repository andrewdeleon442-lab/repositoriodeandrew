function buscarPaquete() {
  const codigo = document.getElementById('codigoPaquete').value.trim();
  const resultado = document.getElementById('resultadoPaquete');
  const mapaDiv = document.getElementById('mapaPaquete');
  if (!codigo) {
    resultado.innerHTML = '<span style="color: red;">Por favor ingrese un código de paquete</span>';
    mapaDiv.style.display = 'none';
    return;
  }
  resultado.innerHTML = '<span style="color: blue;">Buscando paquete...</span>';
  fetch(`/paquete/${codigo}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
      return res.json();
    })
    .then(data => {
      if (mapaDiv._leaflet_id) {
        mapaDiv._leaflet_id = null;
        mapaDiv.innerHTML = "";
      }
      if (data.error) {
        resultado.innerHTML = `<span style="color: red;"> ${data.error}</span>`;
        mapaDiv.style.display = 'none';
        return;
      }
      if (data.lat && data.lng) {
        resultado.innerHTML = `
          <span style="color: green;">Paquete encontrado</span><br>
          <strong>Código:</strong> ${codigo}<br>
          <strong>Ubicación:</strong> ${data.lat}, ${data.lng}<br>
          <strong>Estado:</strong> ${data.estado || 'No especificado'}
        `;
        mapaDiv.style.display = 'block';
        const mapa = L.map('mapaPaquete').setView([data.lat, data.lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(mapa);
        L.marker([data.lat, data.lng])
          .addTo(mapa)
          .bindPopup(`
            <strong>Paquete ${codigo}</strong><br>
            Estado: ${data.estado || 'No especificado'}<br>
            Última actualización: ${new Date().toLocaleString()}
          `)
          .openPopup();
      } else {
        resultado.innerHTML = '<span style="color: red;">Paquete no encontrado</span>';
        mapaDiv.style.display = 'none';
      }
    })
    .catch(error => {
      console.error('Error:', error);
      resultado.innerHTML = '<span style="color: red;">Error de conexión con el servidor</span>';
      mapaDiv.style.display = 'none';
    });
}