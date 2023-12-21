const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const alumniDB = require('./alumni-model'); // Adjust the path as per your project structure

// Manager credentials
const MANAGER_EMAIL = "manager@alueducation.com";
const MANAGER_PASSWORD_HASH = "$2b$10$L58EDhY3cEDe66R6mLEvrO7vYO3ZqQLKOzCPvmGTDYPosBh/EhWFC"; 

module.exports = function(passport) {
    passport.use(new LocalStrategy(
        { usernameField: 'email' },
        async (email, password, done) => {
            // Manager Authentication
            if (email === MANAGER_EMAIL) {
                if (bcrypt.compareSync(password, MANAGER_PASSWORD_HASH)) {
                    return done(null, { email: MANAGER_EMAIL, role: 'manager' });
                } else {
                    return done(null, false, { message: 'Incorrect password for manager' });
                }
            }

            // Alumni Authentication Logic
            try {
                const user = await alumniDB.findOne({ email: email });

                if (!user) {
                    return done(null, false, { message: 'No user found with this email' });
                }

                if (!bcrypt.compareSync(password, user.password)) {
                    return done(null, false, { message: 'Incorrect password' });
                }

                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }
    ));

    passport.serializeUser((user, done) => {
      if (user.email === MANAGER_EMAIL) {
          done(null, user.email); // Serialize the manager by email
      } else {
          done(null, user._id); // Serialize alumni by _id
      }
  });
  
  passport.deserializeUser(async (idOrEmail, done) => {
      if (idOrEmail === MANAGER_EMAIL) {
          done(null, { email: MANAGER_EMAIL, isManager: true }); // Deserialize the manager
      } else {
          try {
              const user = await alumniDB.findOne({ _id: idOrEmail });
              done(null, user); // Deserialize alumni
          } catch (err) {
              done(err, null);
          }
      }
  });
};


