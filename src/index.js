const puppeteer = require('puppeteer');
const XLSX = require("xlsx");
const pages = require('./pages');
const companies = require('./companies');


(async function scrape() {
    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: "~/Library/Application Support/Google/Chrome",
        args: ['--lang=ru-Ru,ru']
    });
    const page = await browser.newPage();
    await page.goto(pages["Проект А"][0]);
    await page.waitForSelector('.rc-pagination-item');

    let list = []
    for (let companyListItem in pages) {
        for (let i = 0; i < pages[companyListItem].length; i++) {

            await page.goto(pages[companyListItem][i]);
            console.log(pages[companyListItem][i])
            await page.waitForSelector('.DriverLink_container__35QA8');

            /* Main logic*/
            let driversList = await page.evaluate(() => {
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

                return drivers
            })

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
})();