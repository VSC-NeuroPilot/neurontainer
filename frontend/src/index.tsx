import { render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';
import { DockerMuiV6ThemeProvider } from '@docker/docker-mui-theme';

import { Header } from './components/Header.jsx';
import { Home } from './pages/Home/index.jsx';
import { NotFound } from './pages/_404.jsx';
import './style.css';

export function App() {
	return (
		<DockerMuiV6ThemeProvider>
			<LocationProvider>
				<Header />
				<main>
					<Router>
						<Route path="/" component={Home} />
						<Route default component={NotFound} />
					</Router>
				</main>
			</LocationProvider>
		</DockerMuiV6ThemeProvider>
	);
}

render(<App />, document.getElementById('app'));
