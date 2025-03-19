const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const listId = urlParams.get('listId')
        
window.onload = () => {
    loadData(listId)
}

class PackingList {
    name = "";
    items = [];
    itemCount = 0;
    categories = [];
    totalWeightGrams = 0;
    totalWeightOunces = 0;

    constructor(name, items) {
        this.name = name;
        this.items = items.toSorted((a, b) => {
            if(a.category == b.category) {
                return a.name.localeCompare(b.name, { sensitivity: 'accent' });
            } else {
                return a.category.localeCompare(b.category, { sensitivity: 'accent' });
            }
        });

        const categoryMap = new Map();
        this.items.forEach((currentItem) => {
            this.itemCount += currentItem.quantity;
            const itemCategoryName = currentItem.category;
            const existingCategory = categoryMap.get(itemCategoryName);
            if(existingCategory == null) {
                const newCategory = new Category(itemCategoryName, this.items.filter((element) => {
                    return element.category == itemCategoryName;
                }));
                this.categories.push(newCategory);
                categoryMap.set(itemCategoryName, newCategory);
            }
        });

        this.categories.sort((a,b) => {
            return a.name.localeCompare(b.name, { sensitivity: 'accent' });
        })

        this.totalWeightGrams = this.items.reduce((accumulator, currentItem) => {
            return accumulator + currentItem.weightGrams;
        }, 0);

        this.totalWeightOunces = this.items.reduce((accumulator, currentItem) => {
            return accumulator + currentItem.weightOunces;
        }, 0);
    }
}

class Category {
    name = "";
    items = [];
    weightGrams = 0;
    weightOunces = 0;

    constructor(name, items) {
        this.name = name;
        this.items = items.toSorted((a,b) => {
            return a.name.localeCompare(b.name, { sensitivity: 'accent' });
        })

        this.weightGrams = this.items.reduce((accumulator, currentValue) => {
            return accumulator + currentValue.weightGrams;
        }, 0);
        this.weightOunces = this.items.reduce((accumulator, currentValue) => {
            return accumulator + currentValue.weightOunces;
        }, 0);
    }
}

let isImperial = false;

function toggleUnits() {
    isImperial = !isImperial;
    updateUnitsLabel(isImperial)
    updateUI(packingList, isImperial);
}

let packingList;

async function loadData(listId) {
    var json = await fetchValueFromCloudKit(listId)
    if(json) { 
        packingList = new PackingList(json.name, json.listItems);
        isImperial = json.preferredUnits == 'oz';
        updateUI(packingList, isImperial);
    } else {
        showNotFoundUI();
    }
}

async function fetchValueFromCloudKit(key) {
    CloudKit.configure({
        containers: [{
            containerIdentifier: 'iCloud.com.moapps.PackLight',
            apiTokenAuth: {
                apiToken: '{{ site.ck_api_token }}',
                persist: true 
            },
            environment: '{{ site.ck_env}}'
        }]
    });

    const database = CloudKit.getDefaultContainer().publicCloudDatabase;

    try {
        const response = await database.fetchRecords(key);
        const record = response.records[0];

        if (record && record.fields.value) {
            const jsonObject = JSON.parse(record.fields.value.value);
            return jsonObject;
        } else {
            console.warn('No value found for key:', key);
            return null;
        }
    } catch (error) {
        console.error('Error fetching record:', error);
    }
}

function updateUI(packingList, isImperial) {
    if(isImperial == undefined) isImperial = false;
    document.getElementById("listName").innerText = (packingList.name && packingList.name != "") ? packingList.name : "Unnamed List";
    document.getElementById("listHeader").style.visibility = "visible";
    document.getElementById("mobileControls").style.visibility = "visible";
    updateUnitsLabel(isImperial)
    document.getElementById("listSummary").innerText = packingList.itemCount + " items : " + (isImperial ? formatOz(packingList.totalWeightOunces) : formatGrams(packingList.totalWeightGrams));
    drawTable(packingList, isImperial);
    drawGraph(packingList);
    if(packingList.totalWeightGrams == 0) {
        hideGraph();
    }
}

function updateUnitsLabel(isImperial) {
    document.getElementById("unitsButton").innerText = isImperial ? "imperial" : "metric";
    document.getElementById("mobileUnitsButton").innerText = isImperial ? "imperial" : "metric";
}

function toggleGraph() {
    const graphHidden = getComputedStyle(document.getElementById("graph")).display == 'none';
    if(graphHidden) {
        showGraph();
    } else {
        hideGraph();
    }
}

function showGraph() {
    document.getElementById("graphToggleButton").innerText = "Hide Graph";
    document.getElementById("graph").style.display = 'block';
}

function hideGraph() {
    document.getElementById("graphToggleButton").innerText = "Show Graph";
    document.getElementById("graph").style.display = 'none';
}

function showNotFoundUI() {
    document.getElementById("listName").innerText = "List Not Found!";
    document.getElementById("listHeader").style.visibility = "visible";
    document.getElementById("unitsButtonContainer").style.visibility = "hidden";
    document.getElementById("mobileControls").style.visibility = "hidden"; 
    document.getElementById("listContainer").innerText = "If the url is correct, the owner has likely taken the list offline."
}

function drawTable(packingList, isImperial) {
    var tableHtml = "";
    packingList.categories.forEach((category) => {
        let items = category.items;
        tableHtml += `<tr style="font-weight: bold;"><td><p class="categoryCell">${category.name}</p><td><p class="categoryCell weightCell">${isImperial ? formatOz(category.weightOunces) : formatGrams(category.weightGrams)}</p></td></tr>`;
        tableHtml += items.reduce(
            
            (accumulator, currentValue) => {
                let currentName = "Unnamed Item";
                if(currentValue.name && currentValue.name.trim() != "") {
                    currentName = currentValue.name;
                    if(currentValue.quantity > 1) {
                        currentName += " x " + currentValue.quantity;
                    }
                }
                return accumulator + `<tr><td>${currentName}</td><td class="weightCell">${isImperial ? formatOz(currentValue.weightOunces) : formatGrams(currentValue.weightGrams)}</td></tr>`;
            }
            ,
            ""
        );
    });
    document.getElementById("listItems").innerHTML = tableHtml;
}

function drawGraph(packingList) {
    const categoryArray = Array.from(packingList.categories).sort((a,b) => { 
        return b.weightGrams - a.weightGrams;
    })
    
    var html = "";
    const maxWeight = categoryArray[0].weightGrams;
    
    categoryArray.forEach((category) => {
        const percentage = category.weightGrams / packingList.totalWeightGrams;
        const widthPercentage = category.weightGrams / maxWeight;
        const formattedPercentage = Number(percentage).toLocaleString(undefined,{style: 'percent', minimumFractionDigits:2});
        const formattedWidthPercentage = Number(widthPercentage).toLocaleString(undefined,{style: 'percent', minimumFractionDigits:2});
        html += `<p class="categorySummary">${category.name} (${formattedPercentage})</p>`;
        html += "<div style=\"height: 10px; width: " + formattedWidthPercentage + ";background-color: #449C1A;\"></div>";
    })

    document.getElementById("graph").innerHTML = html
}

function formatOz(weight) {
    let pounds = Math.floor(weight / 16);
    let ounces = pounds == 0 ? weight : weight % 16;
    const weightFormatter = new Intl.NumberFormat(navigator.language, {
        style: 'decimal',
        useGrouping: "min2",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
    const formattedWeight = weightFormatter.format(ounces);

    const poundText = pounds != 0 ? `${pounds} lbs ` : ""
    return `${poundText}${formattedWeight} oz`;
}

function formatGrams(weight) {
    const weightFormatter = new Intl.NumberFormat(navigator.language, {
        style: 'decimal',
        useGrouping: "min2",
        minimumFractionDigits: 0,
        maximumFractionDigits: 1
    });
    const formattedWeight = weightFormatter.format(weight);
    return `${formattedWeight} g`;
}