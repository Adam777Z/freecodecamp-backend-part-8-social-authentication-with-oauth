'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const fccTesting = require('./freeCodeCamp/fcctesting.js');
const session = require('express-session');
const mongo = require('mongodb').MongoClient;
const passport = require('passport');
const GitHubStrategy = require('passport-github').Strategy;

const app = express();

fccTesting(app); // For FCC testing purposes

app.use('/public', express.static(process.cwd() + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'pug');

mongo.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }, (err, db) => {
	if (err) {
		console.log('Database error: ' + err);
	} else {
		console.log('Successful database connection');

		app.use(session({
			secret: process.env.SESSION_SECRET,
			resave: true,
			saveUninitialized: true
		}));

		app.use(passport.initialize());
		app.use(passport.session());

		function ensureAuthenticated(req, res, next) {
			if (req.isAuthenticated()) {
				return next();
			}
			res.redirect('/');
		};

		passport.serializeUser((user, done) => {
			done(null, user.id);
		});

		passport.deserializeUser((id, done) => {
			db.db().collection('socialusers').findOne(
				{ id: id },
				(err, doc) => {
					done(null, doc);
				}
			);
		});


		/*
		*  ADD YOUR CODE BELOW
		*/

		passport.use(new GitHubStrategy({
			clientID: process.env.GITHUB_CLIENT_ID,
			clientSecret: process.env.GITHUB_CLIENT_SECRET,
			callbackURL: 'https://freecodecamp-backend-part-8-social-authentication-with-oauth.adam777z.repl.co/auth/github/callback'
		},
			function (accessToken, refreshToken, profile, cb) {
				console.log(profile);
				//Database logic here with callback containing our user object
				db.db().collection('socialusers').findOneAndUpdate(
					{ id: profile.id },
					{
						$setOnInsert: {
							id: profile.id,
							name: profile.displayName || 'John Doe',
							photo: profile.photos[0].value || '',
							email: profile.emails[0].value || 'No public email address',
							created_on: new Date(),
							provider: profile.provider || ''
						}, $set: {
							last_login: new Date()
						}, $inc: {
							login_count: 1
						}
					},
					{ upsert: true, returnDocument: 'after' }, // Insert object if not found, Return the updated document
					(err, doc) => {
						return cb(null, doc.value);
					}
				);
			}
		));

		app.route('/auth/github').get(passport.authenticate('github'));

		app.route('/auth/github/callback').get(passport.authenticate('github', { failureRedirect: '/' }), (req, res) => {
			res.redirect('/profile');
		});

		/*
		*  ADD YOUR CODE ABOVE
		*/


		app.route('/')
			.get((req, res) => {
				res.render(process.cwd() + '/views/pug/index');
			});

		app.route('/profile')
			.get(ensureAuthenticated, (req, res) => {
				res.render(process.cwd() + '/views/pug/profile', { user: req.user });
			});

		app.route('/logout')
			.get((req, res) => {
				req.logout((err) => {
					if (err) { return next(err); }
					res.redirect('/');
				});
			});

		app.use((req, res, next) => {
			res.status(404)
				.type('text')
				.send('Not Found');
		});

		const listener = app.listen(process.env.PORT || 3000, () => {
			console.log('Listening on port ' + listener.address().port);
		});
	}
});