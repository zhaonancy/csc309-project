import React from 'react';

import { Route, Switch, BrowserRouter } from 'react-router-dom';
import './App.css';

import Home from './react-components/Home';
import Login from './react-components/Login'
import SignUp from './react-components/SignUp'
import Dashboard from './react-components/Dashboard'

import { readCookie } from "./actions/user";

class App extends React.Component {
  constructor(props) {
    super(props);
    readCookie(this); 
  }

  state = {
    currentUser: null
  }
  render() {
    const { currentUser } = this.state;
    return (
      <div className="App">
        <BrowserRouter>
          <Switch>
            <Route
              exact path={["/", "/login"] /* any of these URLs are accepted. */}
              render={({ history }) => (
                <div className="app">
                  { /* Different componenets rendered depending on if someone is logged in. */}
                  {!currentUser ? <Login history={history} app={this} /> : <Home history={history} app={this} />}
                </div>

              )}
            />
            <Route
              exact path="/register" /* any of these URLs are accepted. */
              render={({ history }) => (
                <div className="app">
                  { /* Different componenets rendered depending on if someone is logged in. */}
                  {!currentUser ? <SignUp history={history} app={this} /> : <Home history={history} app={this} />}
                </div>

              )}
            />
          </Switch>
        </BrowserRouter>
      </div>
    );
  }
}

export default App;