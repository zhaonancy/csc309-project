/* server.js, with mongodb API and static directories */
'use strict';
const log = console.log;
const path = require('path');
const express = require('express');

// starting the express server
const app = express();

// mongoose and mongo connection
const {	mongoose } = require('./db/mongoose');
mongoose.set('useFindAndModify', false); // for some deprecation issues

// import the mongoose models
const { User } = require('./models/user');
const {	Booking } = require('./models/booking');

// to validate object IDs
const {	ObjectID } = require('mongodb');

// body-parser: middleware for parsing HTTP JSON body into a usable object
const bodyParser = require('body-parser');
app.use(bodyParser.json());

// middleware for delete in html forms
// const methodOverride = require('method-override');
// app.use(methodOverride('_method'));

// express-session for managing user sessions
const session = require('express-session');
app.use(bodyParser.urlencoded({	extended: true }));


/*** Session handling **************************************/
// Create a session cookie
app.use(session({
	secret: 'oursecret',
	resave: false,
	saveUninitialized: false,
	cookie: {
		expires: 300000,
		httpOnly: true
	}
}));


// Our own express middleware to check for 
// an active user on the session cookie (indicating a logged in user.)
const sessionChecker = (req, res, next) => {
	if (req.session.user) {
		if(req.session.usertype === 'performer'){
			res.redirect('/dashboard-performer')
		}
		else if(req.session.usertype === 'venue'){
			res.redirect('/dashboard-venue')
		}
		else if(req.session.usertype === 'admin'){
			res.redirect('/admin')
		}
		else{
			res.redirect('./index.html');
		} // redirect to dashboard if logged in.
	} else {
		next(); // next() moves on to the route.
	}
};


// A route to login and create a session
app.post("/users/login", sessionChecker, (req, res) => {
	const username = req.body.username;
	const password = req.body.password;
	log('user logged in is: ' + username);
	// Use the static method on the User model to find a user
	// by their username and password
	User.findByUsernamePassword(username, password)
		.then(user => {
			// Add the user's id to the session cookie.
			// We can check later if this exists to ensure we are logged in.
			req.session.user = user._id;
			req.session.username = user.username;
			req.session.usertype = user.usertype;
			req.session.name = user.name;
			req.session.phone = user.phone;
			req.session.location = user.location;
			req.session.genre = user.genre;
			req.session.descripton = user.description;
			req.session.selectedFor = user.selectedFor;
			// res.send({ currentUser: user.email });
			if (req.session.usertype === 'admin') {
				log("Admin logged in");
				res.redirect('/admin'); // takes you to admin dash
			} else if (req.session.usertype === 'performer') {
				log("Performer logged in");
				res.redirect('/dashboard-performer');
			} else if (req.session.usertype === 'venue') {
				log("Venue logged in");
				res.redirect('/dashboard-venue');
			} else {
				res.redirect('/index');
			}
		}
	)
	.catch(error => {
		// res.status(400).send()
		res.status(400).redirect('/login');
	});
});


// Middleware for authentication of resources
const authenticate = (req, res, next) => {
	if (req.session.user) {
		User.findById(req.session.user).then((user) => {
			if (!user) {
				return Promise.reject();
			} else {
				req.user = user;
				next();
			}
		}).catch((error) => {
			res.status(401).send("Unauthorized");
		});
	} else {
		res.status(401).send("Unauthorized");
	}
};


/*** Webpage routes below **********************************/

// static js directory
app.use("/js", express.static(path.join(__dirname, '/public/js')));

// route for root
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, '/public/index.html'));
});

// static img directory
app.use("/img", express.static(__dirname + '/public/img'));


/** User routes below **/
// Set up a POST route to *create* a user of your web app.
// Note both performers and venues are performers.
app.post('/users/signup', sessionChecker, (req, res) => {
	log('Logged in:'+ req.body.username);
	// Create a new user
	const user = new User({
		username: req.body.username,
		password: req.body.password,
		usertype: req.body.usertype,
		// name: req.body.name,
		name: "",
		phone: "",
		location: "",
		genre: "",
		description: "",
		selectedFor: []
	});
	// Save the user to mongo
	user.save().then((user) => {
			req.session.user = user._id;
			req.session.username = user.username;
			req.session.usertype = user.usertype;

			if (req.session.usertype === 'performer') {
				res.redirect('/makeprofileperformer');
			} else if (req.session.usertype === 'venue') {
				log('redirecting to make profile for ' + req.session.user + req.session.usertype);
				res.redirect('/makeprofilevenue');
			} else if (req.session.usertype === 'admin') {
				res.redirect('/admin');
			} 
			else{
				res.redirect('/');
			}
		},
		(error) => {
			res.status(400).send(error); // 400 for bad request
		}
	);
});


// A route to logout a user
app.get('/users/logout', (req, res) => {
	// Remove the session
	req.session.destroy((error) => {
		if (error) {
			res.status(500).send(error);
		} else {
			res.redirect('/index.html');
		}
	});
});


// a GET route to get all users
app.get('/users', (req, res) => {
	User.find().then((users) => {
		res.send({ users }); // can wrap in object if want to add more properties
	}, (error) => {
		res.status(500).send(error); // server error
	});
});


// a GET route to get a specific user
app.get('/users/:username', (req, res) => {
	// const username = req.body.username;
	const username = req.params.username;
	// Find user
	// to get by _id uncomment one of the below lines
	// User.findOne({ '_id': username}).then(user => {
	// User.findById(username).then(user => {
	// to get by username
	User.findOne({ 'username': username }).then(user => {	
		if (!user) {
			res.status(404).send();  // could not find this user
		} else {
			res.send(user);
		}
	}).catch((error) => {
		res.status(500).send(error);  // server error
	});
});


// a DELETE route to delete a specific user
app.delete('/users', (req, res) => {
	const username = req.body.username;

	// Find user
	User.findOneAndDelete({ 'username': username }).then(user => {	
		if (!user) {
			res.status(404).send();  // could not find this user
		} else {
			res.send(user);
		}
	}).catch((error) => {
		res.status(500).send(error);  // server error, could not delete
	});
});


// for make_profile.js, user to change password
app.patch('/users/pw', (req, res) => {
	// get the new password from the request body.
	const username = req.session.username;
	const password = req.body.password;
	// Update the user's password
	User.findOne({ 'username': username }).then(user => {
		if (!user) {
			res.status(404).send(); // could not find this user
		} else {  
			user.password = password;
			user.save().then(user => {
				res.send(user);
			}).catch(error => {
				res.status(500).send(error);
			});
		}
	}).catch((error) => {
		res.status(400).send(error); // bad request for changing the user's password
	});
});


// for get_selectedFor.js
// a GET route to get a specific user using req.session.username
app.get('/selectedFor', (req, res) => {
	// const username = req.body.username;
	const username = req.session.username;

	// Find user
	// to get by _id uncomment one of the below lines
	// User.findOne({ '_id': username}).then(user => {
	// User.findById(username).then(user => {
	// to get by username
	User.findOne({ 'username': username }).then(user => {	
		if (!user) {
			res.status(404).send();  // could not find this user
		} else {
			res.send(user);
		}
	}).catch((error) => {
		res.status(500).send(error);  // server error
	});
});


// for make_profile.js
// for user to update their profile info
app.patch('/updateprofile', (req, res) => {
	// get the updated info only from the request body.
	const id = req.session.user;
	if (!ObjectID.isValid(id)) {
		res.status(404).send();
		return;
	}
	// Update the performer by their id.
	User.findById(id).then((user) => {
		if (!user) {
			res.status(404).send();
		} else {
			Object.keys(req.body).forEach(key => {
				user[key] = req.body[key];
			});
			user.save().then((user) => {
				res.send(user);
			}).catch((error) => {
				res.status(500).send(error);
			});
		}
	}).catch((error) => {
		res.status(400).send(error); // bad request for updating user
	});
});


// Update user in db with venue information from make profile
app.post('/makeprofilevenue/:username', (req, res) => {
	// Find user
	const username = req.params.username;
	User.findOne({
		username: username
	}).then(user => {
		if (!user) {
			res.status(404).send(); // Cannot find resource
		} else {
			user.name = req.body.name;
			user.location = req.body.location;
			user.phone = req.body.phone;
			user.description = req.body.description;
			// Save the user to mongo
			user.save().then(user => {
				res.send(user);
			}, error => {
				res.status(400).send(error); // Bad request
			});
		}
	}).catch(error => {
		res.status(400).send(error); // Bad request for updating user
	});
});


// Set up a POST route to *create* a booking for a venue.
app.post('/bookings', (req, res) => {

	// Create a new request
	const booking = new Booking({
		venuename: req.body.venuename,
		location: req.body.location,
		bookingDate: req.body.bookingDate,
		phone: req.body.phone,
		description: req.body.description,
		applications: []
	});
	// Save the request
	booking.save().then(booking => {
		// res.send(booking);
		if (req.session.usertype === 'admin') {
			res.redirect('/admin'); // takes you to admin dash
		} else if (req.session.usertype === 'performer') {
			res.redirect('/dashboard-performer');
		} else if (req.session.usertype === 'venue') {
			res.redirect('/dashboard-venue');
		}
		}, (error) => {
			res.status(400).send(error); // 400 for bad booking
		});
});


// a GET route to get all bookings for all venues
app.get('/bookings', (req, res) => {
	Booking.find().then((bookings) => {
		res.send({ bookings }); // can wrap in object if want to add more properties
	}, (error) => {
		res.status(500).send(error); // server error
	});
});


// a DELETE route to delete a specific booking
app.delete('/bookings', (req, res) => {
	const venuename = req.body.venuename;
	// Find booking
	Booking.findOneAndDelete({ 'venuename': venuename }).then(booking => {	
		if (!booking) {
			res.status(404).send(); // could not find this booking
		} else {
			res.send(booking);
		}
	}).catch((error) => {
		res.status(500).send(error);  // server error, could not delete
	});
});


// for admin.js, admin to update booking info
app.patch('/bookings', (req, res) => {
	// get the updated date and description only from the request body.
	const venuename = req.body.venuename;
	const bookingDate = req.body.bookingDate;
	const description = req.body.description;
	// Update the booking by their id, venuename.
	Booking.findOne({ 'venuename': venuename }).then(booking => {
		if (!booking) {
			res.status(404).send(); // could not find this booking
		} else {  
			booking.bookingDate = bookingDate;
			booking.description = description; 
			booking.save().then(booking => {
				res.send(booking);
			}).catch(error => {
				res.status(500).send(error);
			});
		}
	}).catch((error) => {
		res.status(400).send(error); // bad request for changing the booking
	});
});


app.post('/bookings/apply/:id', (req, res) => {
	/// req.params has the wildcard parameters in the url, in this case, id.
	const id = req.params.id;

	// Good practise: Validate id immediately.
	if (!ObjectID.isValid(id)) {
		res.status(404).send(); // if invalid id, definitely can't find resource, 404.
		return; // so that we don't run the rest of the handler.
	}

	// Otherwise, findById
	Booking.findById(id).then((booking) => {
		if (!booking) {
			res.status(404).send(); // could not find this booking
		} else {
			booking.applications.push(req.session.username);
			booking.save().then((result) => {
				// pass the reservation that was just pushed
				// note that mongoose provided an _id when it was pushed
				if (req.session.usertype === 'admin') {
					res.redirect('/admin'); // takes you to admin dash
				} else if (req.session.usertype === 'performer') {
					res.redirect('/dashboard-performer');
				} else if (req.session.usertype === 'venue') {
					res.redirect('/dashboard-venue');
				// Should never get here
				} else {
					res.redirect('/index');
				}

			}).catch((error) => {
				res.status(500).send(); // server error
			});
		}
	}).catch((error) => {
		res.status(500).send(); // server error
	});
});


// for view_available_bookings.js
// for performer to their username to a booking
app.post('/bookings/applyByVenue/:venuename', (req, res) => {
	/// req.params has the wildcard parameters in the url, in this case, id.
	const venuename = req.params.venuename;

	// Good practise: Validate id immediately.
	// if (!ObjectID.isValid(id)) {
	// 	res.status(404).send()  // if invalid id, definitely can't find resource, 404.
	// 	return;  // so that we don't run the rest of the handler.
	// }
	Booking.findOne({ venuename: venuename }).then((booking) => {
		if (!booking) {
			res.status(404).send(); // could not find this venue
		} else {
			booking.applications.push(req.session.username);
			booking.save().then((result) => {
				// pass the reservation that was just pushed
				// note that mongoose provided an _id when it was pushed

				if (req.session.usertype === 'admin') {
					res.redirect('/admin'); // takes you to admin dash
				} else if (req.session.usertype === 'performer') {
					res.redirect('/dashboard-performer');
				} else if (req.session.usertype === 'venue') {
					res.redirect('/dashboard-venue');
				}
			}).catch((error) => {
				res.status(500).send(); // server error
			});
		}
	}).catch((error) => {
		res.status(500).send(); // server error
	});
});


// for get_applicants_for_booking.js
// for venue to choose a performer for a booking
app.post('/users/choosePerformer/:performername', (req, res) => {
	/// req.params has the wildcard parameters in the url, in this case, id.

	const performername = req.params.performername;
	// log(req.body); // this will show object contents
	// log("req.body is: " + req.body); // this will show [Object object]

	// Good practise: Validate id immediately.
	// if (!ObjectID.isValid(id)) {
	// 	res.status(404).send()  // if invalid id, definitely can't find resource, 404.
	// 	return;  // so that we don't run the rest of the handler.
	// }
	// Otherwise, findById
	User.findOne({ 'username': performername }).then(user => {	
		if (!user) {
			res.status(404).send(); // could not find this performer
		} else {
			user.selectedFor.push(req.body);
			// below code saves an object to 
			// user.selectedFor.push(req.body.venueName);
			user.save().then((result) => {
				// pass the reservation that was just pushed
				// note that mongoose provided an _id when it was pushed
				res.send({ user });
				if (req.session.usertype === 'admin') {
					res.redirect('/admin'); // takes you to admin dash
				} else if (req.session.usertype === 'performer') {
					res.redirect('/dashboard-performer');
				} else if (req.session.usertype === 'venue') {
					res.redirect('/dashboard-venue');
				}
			}).catch((error) => {
				res.status(500).send(); // server error
			});
		}
	}).catch((error) => {
		res.status(500).send(); // server error
	});
});


app.get('/profile', (req, res) => {
	// get the updated name and year only from the request body.
	const username = req.session.username;
	User.findOne({ 'username': username }).then(user => {	
		if (!user) {
			res.status(404).send();  // could not find this user
		} else {
			log('sending user');
			res.send(user);
		}
	}).catch((error) => {
		res.status(500).send(error);  // server error
	});
});


// ****************************************************************************
// sessionChecker will run before the route handler and check if we are
// logged in, ensuring that we go to the dashboard if that is the case.

// The various redirects will ensure a proper flow between login and dashboard
// pages so that users have a proper experience on the front-end.

// route for root: should redirect to login route
app.get('/', sessionChecker, (req, res) => {
	res.redirect('/index');
});


// dashboard route will check if the user is logged in and server
// the dashboard page
app.get('/dashboard', (req, res) => {
	if (req.session.usertype === 'performer') {
		res.sendFile(__dirname + '/public/dashboard-performer.html');
	} else if (req.session.usertype === 'venue') {
		res.sendFile(__dirname + '/public/dashboard-venue.html');
	} 
});


app.get('/dashboard-performer', (req, res) => {
	if (req.session.usertype === 'performer') {
		res.sendFile(__dirname + '/public/dashboard-performer.html');
	} else {
		res.redirect('/login');
	}
});


app.get('/dashboard-venue', (req, res) => {
	if (req.session.usertype === 'venue') {
		res.sendFile(__dirname + '/public/dashboard-venue.html');
	} else {
		res.redirect('/login');
	}
});


app.get('/makeprofileperformer/', (req, res) => {
	log("Loaded Make Profile for Performer.")
	if (req.session.user) {
		res.sendFile(__dirname + '/public/makeprofileperformer.html');
	} else {
		res.redirect('/login');
	}
});


app.get('/makeprofilevenue', (req, res) => {
	if (req.session.user) {
		res.sendFile(__dirname + '/public/makeprofilevenue.html');
	} else {
		res.redirect('/login');
	}
});


app.get('/admin', (req, res) => {
	if (req.session.user) {
		res.sendFile(__dirname + '/public/admin.html');
	} else {
		res.redirect('/login');
	}
});


// A route to check if a use is logged in on the session cookie
app.get("/users/check-session", (req, res) => {
	if (req.session.user) {
		res.send({
			currentUser: req.session.username
		});
	} else {
		res.status(401).send();
	}
});


//*****************************************************************************

/*** Webpage routes below **********************************/
// Serve the build
app.use(express.static(__dirname + "/public"));


// All routes other than above will go to index.html
app.get("*", (req, res) => {
	res.sendFile(__dirname + "/public/index.html");
});


/*************************************************/
// Express server listening...
const port = process.env.PORT || 5000;
app.listen(port, () => {
	log(`Listening on port ${port}...`);
});