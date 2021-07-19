const no_events = (logoSrc) => {
    let no_events = document.createElement("div");
    let more_coming = document.createElement("span");
    more_coming.innerHTML = "More Events Coming Soon!";
    more_coming.style.textAlign = "center";
    more_coming.classList.add("text-lg");

    let logo = document.createElement("img");
    logo.src = logoSrc;

    logo.classList.add('w-1/6', 'pt-8');

    no_events.appendChild(logo);
    no_events.appendChild(more_coming);

    no_events.classList.add("flex", "flex-col", "items-center", "justify-center");

    document.getElementById("ly_event_plugin").appendChild(no_events);
}

module.exports = {
    renderNoEvents: no_events
}