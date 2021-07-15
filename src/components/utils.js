var dayjs = require("dayjs");

const getUniqueDates = (e) => {
    let allDates = e.map((x) => ({date: dayjs(x.dateTime).format("YYYY-MM-DD")}));
    let uniqDates = new Set(allDates);

    return Array.from(uniqDates);
}

module.exports = {
    getUniqueDates: getUniqueDates
}