import React from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import Header from './header';
import Footer from './Footer';

const LayoutContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
}));

const MainContent = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
}));

function Layout({ children }) {
  return (
    <LayoutContainer>
      <Header />
      <MainContent>
        {children}
      </MainContent>
      <Footer />
    </LayoutContainer>
  );
}

export default Layout;
