const session = require('express-session');
const NeDBStore = require('connect-nedb-session')(session);
const express = require('express');
const multer = require('multer');
const path = require('path');
const flash = require('connect-flash'); // Include connect-flash
const app = express();
const nedb = require('nedb'); // Include nedb
const upload = multer({ dest: 'uploads/' });
const methodOverride = require('method-override');
const ejs = require('ejs');
app.set('view engine', 'ejs');

// server.js or another entry file
const passport = require('passport');
const initializePassport = require('./passport-config');

initializePassport(passport);

const bodyParser = require('body-parser');
app.use(methodOverride('_method'));

// Use body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Set up your NeDB databases for alumni and events
const eventsDB = new nedb({ filename: 'events.db', autoload: true });
// const alumniDB = new nedb({ filename: 'alumni.db', autoload: true });
const alumniDB = require('./alumni-model')

alumniDB.on('error', (err) => {
  console.error('Error while initializing alumni database:', err);
});

app.use(session({
  secret: 'S3cR3tK3YY', 
  resave: false,
  saveUninitialized: false,
  store: new NeDBStore({
    filename: 'nedb_sessions.db'
  }),
  cookie: {
    maxAge: 3600000, // 1 hour for example
    httpOnly: true, // Helps against XSS attacks
    secure: process.env.NODE_ENV === "production" // Cookie is sent over HTTPS only
  }
}));

app.use(flash()); // Initialize connect-flash

// Initialize Passport and session support
app.use(passport.initialize());
app.use(passport.session());

// Serve static assets (CSS, images, etc.) from the "public" folder
app.use('/public', express.static(path.join(__dirname, 'public')));



// events you want to insert into the database
const sampleEvents = [
  {
    title: 'ALN Summit 2023',
    description: 'The ALN Summit is a dynamic gathering of like-minded individuals, thought leaders, and experts in various fields, all driven by a shared passion for fostering collaboration and innovation.Through engaging talks, interactive workshops, and networking opportunities, attendees can expect to gain valuable insights, build meaningful connections, and explore the latest trends and advancements in their respective industries. Join us at the ALN Summit to be inspired, learn, and contribute to a brighter future together.',
    category: 'professional',
    image: '/public/Images/ALN.webp',
  },
  {
    title: 'Career Fair',
    description: 'Join us at our upcoming career fair event exclusively tailored for alumni. Discover exciting job opportunities, network with industry leaders, and take your career to new heights. Do not miss this chance to connect, grow, and advance your professional journey with fellow alumni.',
    category: 'networking',
    image: '/public/Images/career fair.jpg',
  },
];

// route to insert sample events into the database
app.get('/seedEvents', (req, res) => {
  // Define the sample events as shown above

  // Insert the sample events into the eventsDB collection
  eventsDB.insert(sampleEvents, (err, newEvents) => {
    if (err) {
      // Handle the error
      return res.status(500).json({ error: 'Failed to insert sample events' });
    }

    // Sample events inserted successfully
    res.status(200).json({ message: 'Sample events inserted successfully', newEvents });
  });
});

// Define a middleware to check if the user is the manager
const isManagerAuthenticated = (req, res, next) => {
  if (req.isAuthenticated() && req.user.email === 'manager@alueducation.com') { 
      return next();
  } else {
      res.status(403).send('Access Denied: You are not authorized to view this page');
  }
};

// For parsing JSON payloads
app.use(express.json());

// Initialize Passport and session support
app.use(passport.initialize());
app.use(passport.session());


// Serve static assets (CSS, images, etc.) from the "public" folder
app.use('/public', express.static(path.join(__dirname, 'public')));


const isAuthenticated = (req, res, next) => {
  if (req.user && req.user._id) {
    return next(); // The user is authenticated, proceed to the next function
} else {
  console.log("user logged:", req.user)
    res.status(401).send('User not authenticated'); // Unauthorized access
}
}

app.get('/dashboard', isAuthenticated, (req, res) => {
  eventsDB.find({ participants: req.user._id }, (err, events) => {
      if (err) {
          // handle error, perhaps render the dashboard with an error message or empty events
          console.error('Error fetching events:', err);
          res.render('alumni_dashboard', { events: [] });
      } else {
          // If there are no errors, render the dashboard with the events
          res.render('alumni_dashboard', { events: events });
      }
  });
});

app.post('/login', passport.authenticate('local', {
  failureRedirect: '/views/login.html',
  failureFlash: true
}), (req, res) => {
  // Redirect manager to the manager dashboard
  if (req.user.email === 'manager@alueducation.com') {
      return res.redirect('/manager_dashboard');
  }
  // Redirect alumni to the alumni dashboard
  return res.redirect('/dashboard');
});




app.post('/participate', isAuthenticated, (req, res) => {
  const eventId = req.body.eventId;
  if (!eventId) {
    return res.status(400).send('Event ID is required.');
  }
  const userId = req.user._id;

  // Find the specific event
  eventsDB.findOne({ _id: eventId }, (err, event) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch the event' });
    }
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Check if the event has a participants array, if not, create it
    if (!event.participants) {
      event.participants = [];
    }
    
    // Add the userId to the participants list if not already there
    if (event.participants.indexOf(userId) === -1) {
      event.participants.push(userId);
      
      // Save the updated event
      eventsDB.update({ _id: eventId }, { $set: { participants: event.participants } }, {}, (updateErr, numReplaced) => {
        if (updateErr) {
          return res.status(500).json({ error: 'Failed to participate in the event' });
        }
        
        // Fetch the updated list of events for the user to render the dashboard
        eventsDB.find({ participants: userId }, (findErr, eventsList) => {
          if (findErr) {
            return res.status(500).json({ error: 'Failed to fetch events list' });
          }
          
          // Render the alumni_dashboard with the updated events list
          res.render('alumni_dashboard', { events: eventsList });
        });
      });
    } else {
      // User is already a participant, no need to update the event
      // Just fetch the updated list of events
      eventsDB.find({ participants: userId }, (findErr, eventsList) => {
        if (findErr) {
          return res.status(500).json({ error: 'Failed to fetch events list' });
        }
        
        res.render('alumni_dashboard', { events: eventsList });
      });
    }
  });
});

app.get('/dashboard', function(req, res) {
  var userId = req.user._id; // the user ID from a session or token
  
  // The query should find events where the user's ID is in the participants array
  eventsDB.find({ participants: req.user._id }, (err, events) => {
    // handle error or success
    // return the events to the dashboard
  });
});


// Serve static HTML files from the "views" folder
app.use('/views', express.static(path.join(__dirname, 'views')));

// Define a route handler for the root path ("/")
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});


// Define a route handler for the events page
app.get('/events', (req, res) => {
  eventsDB.find({}, (err, events) => {
    if (err) {
      // Handle the error
      res.status(500).send('Internal Server Error');
    } else {
      // Include the messages object
      res.render('Events', { 
        user: req.user, 
        events: events, 
        event: {}, 
        messages: req.flash() // Include the messages object
      });
    }
  });
});


// Check if an alumni is signed in
app.get('/isAlumniSignedIn', (req, res) => {
  if (req.isAuthenticated()) {
    res.status(200).json({ signedIn: true });
  } else {
    res.status(200).json({ signedIn: false });
  }
});


app.get('/alumni_dashboard', isAuthenticated, (req, res) => {
  // The `req.user` object should contain the authenticated user's data, including the ID
  const userId = req.user._id;

  // Fetch the user's events from the alumniDB
  eventsDB.find({ participants: req.user._id }, (err, events) => {
    if (err) {
      // Handle the error (e.g., render an error page)
      return res.status(500).send('Internal Server Error');
    }

    // Render the alumni_dashboard page with the user's events
    // Assuming you have an "alumni_dashboard.ejs" file in your views directory
    res.render('alumni_dashboard', { events: events });
  });

});


app.get('/editEvent/:eventId', (req, res) => {
  const eventId = req.params.eventId;

  // Retrieve the event from the NeDB database
  eventsDB.findOne({ _id: eventId }, (err, event) => {
      if (err) {
          // Handle any database error
          console.error("Database error occurred:", err);
          req.flash('error', 'Database error occurred while fetching the event.');
          return res.redirect('/events');
      }

      if (!event) {
          // Handle the case where the event does not exist
          req.flash('error', 'Event not found.');
          return res.redirect('/events');
      }

      // Retrieve all events to pass along to the Events template
      eventsDB.find({}, (err, allEvents) => {
          if (err) {
              // Handle error when fetching all events
              console.error("Error fetching all events:", err);
              req.flash('error', 'Error fetching events.');
              return res.redirect('/events');
          }

          // Render the event in the edit form with both the single event and all events
          res.render('Events', { 
              event: event, 
              events: allEvents, 
              messages: req.flash() // Include the messages object
          });
      });
  });
});



// Route to display the form for a new event creation
app.get('/events/new', (req, res) => {
  // Render the Events template without passing an event object
  res.render('Events', { event: null });
});

// Route to display the form for editing an existing event
app.get('/events/edit/:eventId', (req, res) => {
  const eventId = req.params.eventId;
  eventsDB.findOne({ _id: eventId }, (err, event) => {
      if (err) {
          // Handle the error and set flash message
          req.flash('error', 'Error fetching event to edit.');
          res.redirect('/events');
          return;
      }
      if (!event) {
          // Handle case where event does not exist and set flash message
          req.flash('error', 'Event not found.');
          res.redirect('/events');
          return;
      }
      
      // Fetch all events
      eventsDB.find({}, (err, allEvents) => {
          if (err) {
              // Handle error when fetching all events
              req.flash('error', 'Error fetching events.');
              res.redirect('/events');
              return;
          }

          // Render the Events template passing the existing event object and all events
          res.render('Events', {
              event: event,
              events: allEvents, // Pass the full list of events here
              messages: req.flash() // Include the messages object
          });
      });
  });
});



app.post('/events/save', (req, res) => {
  const { eventId, title, description, category } = req.body;
  let event = { title, description, category };

  if (eventId) {
      // Update operation
      eventsDB.update({ _id: eventId }, { $set: event }, {}, handleResponse);
  } else {
      // Create operation
      eventsDB.insert(event, handleResponse);
  }

  function handleResponse(err, docOrNumReplaced) {
      if (err) {
          res.status(500).send('Database operation failed.');
      } else if (!docOrNumReplaced) {
          res.status(404).send('Event not found.');
      } else {
          res.redirect('/events');
      }
  }
});

// Route to handle deleting an event with POST
app.post('/deleteEvent/:eventId', (req, res) => {
  const eventId = req.params.eventId;
  
  eventsDB.remove({ _id: eventId }, {}, (err, numRemoved) => {
    if (err) {
      // Handle the error (e.g., send a status 500 response)
      res.status(500).send('Internal Server Error occurred while trying to delete the event.');
      return;
    }
    
    if (numRemoved === 0) {
      // If no documents were removed, it means the event wasn't found
      res.status(404).send('Event not found or already deleted.');
      return;
    }

    // After a successful deletion, redirect to the events list, or send back a success message.
    res.redirect('/events');
  });
});





app.post('/removeEventFromDashboard', isAuthenticated, function(req, res) {
  // Get the user's ID and the event ID from the request
  const userId = req.user._id; // Assuming req.user._id contains the logged-in user's ID
  const eventIdToRemove = req.body.eventId;

  // Find the specific event by ID
  eventsDB.findOne({ _id: eventIdToRemove }, (err, event) => {
    if (err) {
      // Handle error
      console.error('Error finding event:', err);
      return res.status(500).json({ error: 'Error finding event' });
    }

    if (!event) {
      // Event not found
      return res.status(404).json({ error: 'Event not found' });
    }

    // Remove the userId from the participants array
    const updatedParticipants = event.participants.filter(participantId => participantId !== userId);

    // Save the updated event
    eventsDB.update({ _id: eventIdToRemove }, { $set: { participants: updatedParticipants } }, {}, (updateErr, numReplaced) => {
      if (updateErr) {
        // Handle error
        console.error('Error updating event:', updateErr);
        return res.status(500).json({ error: 'Error updating event' });
      }

      // Redirect to the dashboard page or send a success response
      res.redirect('/alumni_dashboard');
      // or
      // res.status(200).json({ message: 'Event removed successfully' });
    });
  });
});

app.get('/login', (req, res) => {
  const errorMessages = req.flash('error');
  if (errorMessages.length > 0) {
    res.redirect(`/login.html?error=${encodeURIComponent(errorMessages.join('. '))}`);
  } else {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
  }
});

// Direct route to manager dashboard without authentication
app.get('/manager_dashboard', isManagerAuthenticated,(req, res) => {
  console.log("Manager Authenticated:", req.isAuthenticated());
    console.log("Manager User:", req.user);
  
  eventsDB.find({}, (err, events) => {
      if (err) {
          console.error('Error fetching events:', err);
          return res.status(500).send('Internal Server Error');
      }
      alumniDB.find({}, (err, alumni) => {
          if (err) {
              console.error('Error fetching alumni:', err);
              return res.status(500).send('Internal Server Error');
          }
          res.render('manager_dashboard', {
              events: events, 
              alumni: alumni, 
              messages: req.flash() // Include the messages object
          });
      });
  });
});


// Add, Edit, and Delete Alumni Routes
app.get('/alumni/new', (req, res) => {
  res.render('edit_alumni', { alumnus: {} });
});

app.post('/alumni/save', upload.none(), (req, res) => {
  const { alumniId, login, email } = req.body;
  const alumnus = { login, email };

  if (alumniId) {
      alumniDB.update({ _id: alumniId }, { $set: alumnus }, {}, (err) => {
          if (err) res.status(500).send('Error updating alumni');
          else res.redirect('/dashboard');
      });
  } else {
      alumniDB.insert(alumnus, (err) => {
          if (err) res.status(500).send('Error adding alumni');
          else res.redirect('/dashboard');
      });
  }
});

app.get('/alumni/edit/:alumniId', (req, res) => {
  alumniDB.findOne({ _id: req.params.alumniId }, (err, alumnus) => {
      if (err || !alumnus) res.status(404).send('Alumnus not found');
      else res.render('edit_alumni', { alumnus });
  });
});

app.post('/alumni/delete/:alumniId', upload.none(), (req, res) => {
  alumniDB.remove({ _id: req.params.alumniId }, {}, (err) => {
      if (err) res.status(500).send('Error deleting alumni');
      else res.redirect('/dashboard');
  });
});



// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
