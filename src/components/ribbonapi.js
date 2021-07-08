const getRibbonData = async (hostId, token) => {
    const ribbonRes = fetch(`https://api.withribbon.com/api/v1/Events?hostId=${hostId}&token=${token}`)
    .then(response => response.json())
    .then(data => { return data } )
    .catch((err) => console.log(err));

    return ribbonRes;
}

module.exports = {
    getRibbonData: getRibbonData
}