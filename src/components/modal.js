var LineClamp = require("@tvanc/lineclamp");

const buildModal = () => {
    let modal = document.createElement("div");
    modal.id = "ly_description_modal";
    modal.classList.add("hidden", "fixed");

    document.body.appendChild(modal);
}

const destroyModal = () => {
    document.getElementById("ly_description_modal").remove();
    buildModal();
}

const showModal = (data) => {
    let modal = document.getElementById("ly_description_modal");
    modal.classList.remove("hidden");
    
    let description = document.createElement("p");
    description.innerHTML = data;

    modal.appendChild(description);

    let closeButton = document.createElement("button");
    closeButton.innerHTML = "&times; close";
    closeButton.classList.add("w-full", "cursor-pointer", "text-xl", "text-center", "shadow", "p-2", "mt-4", "mb-4");

    closeButton.addEventListener("click", () => {
        destroyModal();
    });

    modal.appendChild(closeButton);
}

const clampDescriptions = () => {
    const elements = document.querySelectorAll(".description");

    elements.forEach((element) => {
        let textToBeClamped = element.innerHTML;

        const clamp = new LineClamp(element, { maxLines: 2 });

        if(clamp.shouldClamp() === true){

            //insert "read more"
            let readMore = document.createElement("span");
            readMore.innerHTML = "read more";
            readMore.classList.add("font-extralight", "cursor-pointer", "ly_desc_readmore");
            readMore.addEventListener("click",(e) => {
                showModal(textToBeClamped);
            });

            element.parentNode.appendChild(readMore);

            clamp.apply();
        }
    });
}

module.exports = {
    buildModal: buildModal,
    destroyModal: destroyModal,
    clampDescriptions: clampDescriptions
    // showModal: showModal
}