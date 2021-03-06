var dayjs = require("dayjs");

const getUniqueDates = (e) => {
    let allDates = e.map((x) => ({date: dayjs(x.dateTime).format("YYYY-MM-DD")}));
    let uniqDates = new Set(allDates);

    return Array.from(uniqDates);
}

const handleResetButtonReset = (flag) => {
    let reset_button = document.getElementById("ly_plugin_reset_button");

    if(flag === 1){
        reset_button.innerHTML = "Showing All Events";
        reset_button.disabled = true;
        reset_button.classList.add("opacity-50", "cursor-not-allowed");
    } else if(flag === 2){
        reset_button.innerHTML = "Clear Filters";
        reset_button.disabled = false;
        reset_button.classList.remove("opacity-50", "cursor-not-allowed");
    }
}

module.exports = {
    getUniqueDates: getUniqueDates,
    handleResetButtonReset: handleResetButtonReset,
}