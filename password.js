const alumniDB = require('./alumni-model'); // adjust the path as needed

async function updateManager() {
    const managerEmail = "manager@alustudent.com"; // The email used for the manager's account
    const managerName = "Your Manager Name"; // The name you want to add

    try {
        await alumniDB.update({ email: managerEmail }, { $set: { name: managerName } }, {});
        console.log("Manager's record updated successfully.");
    } catch (err) {
        console.error("Error updating manager's record:", err);
    }
}

updateManager();
