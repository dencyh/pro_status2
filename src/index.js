const puppeteer = require('puppeteer');
const XLSX = require("xlsx");
const pages = require('./pages');
const companies = require('./companies');
const parks = require('./parks');


const start = async function scrape() {
    const browser = await puppeteer.launch({
        headless: true,
        userDataDir: "~/Library/Application Support/Google/Chrome",
        LANGUAGE: "ru_Ru"
    });
    const page = await browser.newPage();


    let list = []

    for (let park in parks) {
        let initialUrl = `https://fleet.taxi.yandex.ru/drivers?status=working&page=1&limit=100&park_id=${parks[park]}`
        await page.goto(initialUrl);
        await page.waitForSelector('.rc-pagination-item');

        let pagesNums = await page.evaluate(() => {
            return Array.from(document.body.querySelectorAll('.rc-pagination-item')).length
        });


        for (let i = 1; i <= pagesNums; i++) {

            let url = `https://fleet.taxi.yandex.ru/drivers?status=working&page=${i}&limit=100&park_id=${parks[park]}`;
            await page.goto(url);
            await page.waitForSelector('.Table_name__-P4ig .DriverLink_container__35QA8');

            /* Main logic*/
            let driversList = await page.evaluate(scanSinglePage);
            console.log('driversList', driversList)

            list = [...list, ...driversList]
        }
    }

    const correspondingStatus = {
        'Available': 'Свободный',
        'Busy': 'Занят',
        'En route': 'На заказе',
        'Offline': 'Офлайн'
    }
    list.forEach((item) => {
        if (companies[item.company]) {
            item.company = companies[item.company]
        }
        item.status = correspondingStatus[item.status]
    })


    const newWB = XLSX.utils.book_new();

    const WS_name = "Статусы курьеров";
    const WS = XLSX.utils.json_to_sheet(list);
    WS["!cols"] = [
        {wpx: 80},
        {wpx: 80},
        {wpx: 250},
        {wpx: 160},
        {wpx: 80},
        {wpx: 150},
    ];
    XLSX.utils.book_append_sheet(newWB, WS, WS_name);

    XLSX.writeFile(newWB, "./ProStatus.xlsx");

    await browser.close();

};

start();


/* Helper functions */
function scanSinglePage() {

    let drivers = [];
    /* Status */
    let status = Array.from(document.querySelectorAll(".Table_status__3tCyu .DriverStatusCell_badge__BtkR_"))
        .map(element => element.innerText)

    /* Callsign */
    let callsign = Array.from(document.querySelectorAll(".Table_callSign__jOAzL"))
        .slice(1, 101)
        .map(element => element.innerText)

    /* Names */
    let names = Array.from(document.querySelectorAll(".Table_name__-P4ig .DriverLink_container__35QA8"))
        .map(element => element.innerText)
        .map((name) => name.slice(0, name.length - 1));
    let namesShort = names
        .map((name) => name.split(" "))
        .map((name) => name[0] + " " + name[1]);

    /* Phones */
    let phones = Array.from(document.querySelectorAll('td.Text_typography_caption:nth-child(5n)'))
        .filter((element, index) => index % 2 === 0)
        .map(element => element.innerText);
    /* Plate numbers */
    let plateNumbers = Array.from(document.querySelectorAll('td.Text_typography_caption:nth-child(5n)'))
        .filter((element, index) => index % 2 !== 0)
        .map(element => element.innerText.replace('Ford Transit', ''));
    /* Park */
    let companyRaw = document.querySelector(".Text.Text_overflow_ellipsis.Text_typography_body").innerText;
    /*let company = companies[companyRaw]*/

    /*   Pushing data to object */
    status.forEach((status, index) => {
        drivers.push({
            status: status,
            callsign: callsign[index],
            name: names[index],
            nameShort: namesShort[index],
            phone: phones[index],
            plateNumbers: plateNumbers[index],
            company: companyRaw,
        });
    });
    console.log('drivers', drivers)
    return drivers
}