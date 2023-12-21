const bcrypt = require('bcrypt');
const alumniDB = require('./alumni-model'); // Adjust the path as per your project structure

const managerEmail = "manager@alustudent.com";
const managerPassword = "managerALU";
const managerName = "Manager"; 
const saltRounds = 10;

bcrypt.hash(managerPassword, saltRounds, async (err, hash) => {
  if (err) {
    console.error("Error hashing password:", err);
    return;
  }

  // Insert the manager's hashed password into the database
  try {
    const managerData = {
      name: managerName,
      email: managerEmail, 
      password: hash, 
      role: 'manager'
    };
    await alumniDB.insert(managerData);
    console.log("Manager account created successfully");
  } catch (dbErr) {
    console.error("Error inserting manager record:", dbErr);
  }
});
