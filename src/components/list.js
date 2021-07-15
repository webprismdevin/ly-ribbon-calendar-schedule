const createListStructure = () => {
    let listHTML = document.createElement("ul");
    listHTML.classList.add("list");

    document.getElementById("ly_event_plugin").appendChild(listHTML);
}

module.exports = {
    createListStructure: createListStructure
}