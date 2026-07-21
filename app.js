function guardar(){

    const nombre = document.getElementById("nombre").value;
    const matricula = document.getElementById("matricula").value;
    const unidad = document.getElementById("unidad").value;

    localStorage.setItem("nombre", nombre);
    localStorage.setItem("matricula", matricula);
    localStorage.setItem("unidad", unidad);

    alert("Configuración guardada correctamente");
}
