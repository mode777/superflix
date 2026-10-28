import { createHashRouter } from 'react-router-dom';
import { App } from './App';
import BrowseView from './routes/BrowseView';
import ConsoleView from './routes/ConsoleView';
import DetailsView from './routes/DetailsView';
import NotFoundView from './routes/NotFoundView';
import AdminView from './routes/AdminView';

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <BrowseView /> },
      { path: 'game/:slug', element: <DetailsView /> },
      { path: 'play/:slug', element: <ConsoleView /> },
      { path: 'admin', element: <AdminView /> },
      { path: '*', element: <NotFoundView /> },
    ],
  },
]);
