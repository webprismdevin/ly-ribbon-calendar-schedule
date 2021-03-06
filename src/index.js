//dayjs
var dayjs = require("dayjs");
var customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
//vendor modules
var vanillaCalendar = require('./vendor/vanilla-calendar');
var List = require('list.js');
//custom components
let { getRibbonData } = require('./components/ribbonapi');
var modal = require('./components/modal.js');
var utils = require('./components/utils');
var no_events = require('./components/noEvents.js');
var lc = require('./components/list');

/*
set list options and build item templates
*/

let listOptions = {
    valueNames: [ "id", "title", "date", "time", "teacher", "duration", {data: {name: "link", attr: "href"}}, "description", "sort", "month", "img1"],
    item: function(values) {
        //dates are formatted without special characters because it breaks List.js sort
        return `<li class="shadow p-6 relative mt-4" id="${values.id}">
                    <div>
                        <img src="${values.img1}" alt="class image for ${values.title}" height="100px" width="100px">
                    </div>
                    <div class="absolute top-6 left-36">
                        <span>${dayjs(values.date, "YYYYMMDD").format("dddd D MMM YYYY")} at ${values.time}</span>
                        <h1 class="title text-xl mt-1"></h1>
                    </div>
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

//global variables for list and calendar
let lyEventList, lyCalendar, ribbonData;

//Ribbon API id & token
let scriptRootTag = document.getElementById("ly_ribbon_widget_srt");
let hostId = scriptRootTag.getAttribute("hostId"), 
// let hostId = "2916", token = "7e60c8022c",
    token = scriptRootTag.getAttribute("token"),
    logoSrc = scriptRootTag.getAttribute("logoSrc");


//promise to return data from Ribbon API
const initRibbon = async (h,k) => {
    let ribbonData = await getRibbonData(h,k);

    //return API data, but only return events that are after today
    return ribbonData.filter((e) => dayjs(e.dateTime).isAfter(dayjs()));
}

/*
reset button functionality
*/

const buildFilterContainer = () => {
    let filterContainer = document.createElement("div");
    filterContainer.classList.add("flex-row");
    filterContainer.id = "ly_filter_container";

    return filterContainer;
}

const buildFilters = (data) => {
    let el = document.getElementById("ly_event_plugin");
    let filterContainer = buildFilterContainer();

    //add reset button to filter container
    filterContainer.appendChild(createResetButton());

    //create teacher filter
    // createTeacherFilter(data, filterContainer);

    //append to plugin container
    el.prepend(filterContainer);
}

const createResetButton = () => {
    let resetButton = document.createElement("button");
    resetButton.id = "ly_plugin_reset_button";
    resetButton.innerHTML = "Showing All Events";
    resetButton.disabled = true;
    resetButton.classList.add("shadow", "p-2", "pr-4", "pl-4", "m-4", "opacity-50", "cursor-not-allowed");

    resetButton.addEventListener("click", () => handleFilterClear());

    return resetButton;
}

const handleFilterClear = () => {
    lyEventList.search();
    lyCalendar.reset();

    utils.handleResetButtonReset(1);
}

/*
calendar functionality
*/

const createCalStructure = () => {
    let calHTML = document.createElement("div");
    calHTML.id = "ly_event_cal";
    calHTML.classList.add("vanilla-calendar");

    document.getElementById("ly_event_plugin").prepend(calHTML);
}

const handleDateSelection = (data) => {
    //dates are formatted without special characters because it breaks List.js sort
    let searchDate = dayjs(data.data.date).format("YYYYMMDD");

    lyEventList.search(searchDate, 'searchDate');

    utils.handleResetButtonReset(2);
}

const buildCalendar = (events) => {
    lyCalendar = new VanillaCalendar({
        selector: "#ly_event_cal",
        datesFilter: true,
        availableDates: utils.getUniqueDates(events),
        onSelect: (data) => {
            handleDateSelection(data)
        }
    });
}

/*
init functions
*/

//create list & modal elements
lc.createListStructure();
modal.buildModal();

//get data from ribbon
initRibbon(hostId,token).then((data) => {
    let newData = data.map((d) => {
        //creates custom format so List.js can search by date on calendar events
        let searchDate = dayjs(d.dateTime).format("YYYYMMDD").toString();

        console.log(d.image1)
        
        return ({   id: d.id,
                    title: d.title, 
                    date: searchDate, 
                    time: dayjs(d.dateTime).format("hh:mm A"),
                    sort: d.dateTime,
                    teacher: d.teacher, 
                    duration: d.duration,
                    link: d.link,
                    description: d.description,
                    img1: d.image1 === null ? logoSrc : d.image1
                });

    })
    //creates the List.js list
    lyEventList = new List('ly_event_plugin', listOptions, newData);

    //sorts based on DayJS dateTime objects
    lyEventList.sort('sort', {sortFunction: (a,b) => {
        if(dayjs(a.values().sort).isBefore(dayjs(b.values().sort))) return -1;
        else return 1;
    }});

    //line clamp long descriptions and implement a "read more button"
    modal.clampDescriptions();

    return data
}).then((data) => {
    if(data.length > 0){
        // get 'showcalendar' attribute
        let showCalendar = document.getElementById("ly_ribbon_widget_srt").getAttribute('showcalendar') || true;

        //no need to build the calendar if it's not going to be shown.
        if(showCalendar === true){
            buildFilters(data);
            createCalStructure();
            buildCalendar(data);
        }
    } else {
        no_events.renderNoEvents(logoSrc);
    }
});