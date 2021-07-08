var vanillaCalendar = require('./vendor/vanilla-calendar');
var dayjs = require("dayjs");
var customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
var List = require('list.js');
let { getRibbonData } = require('./components/ribbonapi');
var LineClamp = require("@tvanc/lineclamp");


let listOptions = {
    valueNames: [ "id", "title", "date", "time", "teacher", "duration", {data: {name: "link", attr: "href"}}, "description", "sort", "month"],
    item: function(values) {
        //dates are formatted without special characters because it breaks List.js sort
        return `<li class="shadow p-6 relative mt-4" id="${values.id}">
                    <span>${dayjs(values.date, "YYYYMMDD").format("dddd D MMM YYYY")} at ${values.time}</span>
                    <h1 class="title text-xl mt-1"></h1>
                    <div class="text-right absolute top-6 right-6 ly_teacher_duration font-light">
                        <span>Taught by: </span><span class="teacher"></span><br>
                        <span class="duration"></span><span> Minutes</span>
                    </div>
                    <span class="date hidden"></span>
                    <div class="max-w-md mt-8">
                        <span class="description"></span>
                    </div>
                    <a style="background-color: var(--vanilla-calendar-selected-bg-color); color: white; font-weight: 300 !important" class="hover:shadow-lg transition-shadow absolute bottom-6 right-6 p-2 pr-4 pl-4 ly_signup_button" href="${values.link}">Sign Up</a>
                </li>`;
    }
}

let lyEventList, lyCalendar;

var hostId = "6014", token = "54ffc5cb91";


//base functions
const initRibbon = async (h,k) => {
    let ribbonData = await getRibbonData(h,k);

    //return API data, but only return events that are after today
    return ribbonData.filter((e) => dayjs(e.dateTime).isAfter(dayjs()));
}

const createListStructure = () => {
    let listHTML = document.createElement("ul");
    listHTML.classList.add("list");

    document.getElementById("ly_event_plugin").appendChild(listHTML);
}

const createCalStructure = () => {
    let calHTML = document.createElement("div");
    calHTML.id = "ly_event_cal";
    calHTML.classList.add("vanilla-calendar");

    document.getElementById("ly_event_plugin").appendChild(calHTML);
}

const createResetButton = () => {
    let resetButton = document.createElement("button");
    resetButton.id = "ly_plugin_reset_button";
    resetButton.innerHTML = "Showing All Events";
    resetButton.disabled = true;
    resetButton.classList.add("shadow", "p-2", "pr-4", "pl-4", "m-4", "opacity-50", "cursor-not-allowed");

    resetButton.addEventListener("click", () => handleFilterClear())

    document.getElementById("ly_event_plugin").appendChild(resetButton);
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

const getUniqueDates = (e) => {
    let allDates = e.map((x) => ({date: dayjs(x.dateTime).format("YYYY-MM-DD")}));
    let uniqDates = new Set(allDates);

    return Array.from(uniqDates);
}

const handleDateSelection = (data) => {
    //dates are formatted without special characters because it breaks List.js sort
    let searchDate = dayjs(data.data.date).format("YYYYMMDD");

    lyEventList.search(searchDate, 'searchDate');

    handleResetButtonReset(2);

}

const buildCalendar = (events) => {
    lyCalendar = new VanillaCalendar({
        selector: "#ly_event_cal",
        datesFilter: true,
        availableDates: getUniqueDates(events),
        onSelect: (data) => handleDateSelection(data)
    });

    // document.getElementById("ly_event_cal").style = "max-width: 450px !important; margin-left: auto";

}

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

const handleFilterClear = () => {
    lyEventList.search();
    lyCalendar.reset();

    handleResetButtonReset(1);
}

//init functions

// get 'showcalendar' attribute
let showCalendar = document.getElementById("ly_ribbon_widget_srt").getAttribute('showcalendar') || true;

if(showCalendar === true){
    createCalStructure();
    createResetButton();
}

//create list & modal elements
createListStructure();
buildModal();

//get data from ribbon
initRibbon(hostId,token).then((data) => {
    let newData = data.map((d) => {
        //creates custom format so List.js can search by date on calendar events
        let searchDate = dayjs(d.dateTime).format("YYYYMMDD").toString();
        
        return ({   id: d.id,
                    title: d.title, 
                    date: searchDate, 
                    time: dayjs(d.dateTime).format("hh:mm A"),
                    sort: d.dateTime,
                    teacher: d.teacher, 
                    duration: d.duration,
                    link: d.link,
                    description: d.description
                });

    })
    //creates the List.js list
    lyEventList = new List('ly_event_plugin', listOptions, newData);

    //sorts based on DayJS dateTime objects
    lyEventList.sort('sort', {sortFunction: (a,b) => {
        if(dayjs(a.values().sort).isBefore(dayjs(b.values().sort))) return -1;
        else return 1;
    }});

    //no need to build the calendar if it's not going to be shown.
    if(showCalendar === true){
        buildCalendar(data);
    }

    //line clamp long descriptions and implement a "read more button"
    clampDescriptions();
});



