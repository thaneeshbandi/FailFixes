import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Link,
  IconButton,
  Divider,
  Stack,
} from '@mui/material';
import {
  AutoFixHigh,
  Twitter,
  Facebook,
  Instagram,
  LinkedIn,
  GitHub,
  Email,
  Phone,
  LocationOn,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

const StyledFooter = styled(Box)(({ theme }) => ({
  background: `
    linear-gradient(135deg, 
      ${theme.palette.grey[900]} 0%, 
      ${theme.palette.grey[800]} 100%
    )
  `,
  color: theme.palette.common.white,
  marginTop: 'auto',
}));

const FooterLink = styled(Link)(({ theme }) => ({
  color: theme.palette.grey[300],
  textDecoration: 'none',
  fontSize: '0.9375rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': {
    color: theme.palette.primary.light,
    transform: 'translateX(4px)',
  },
}));

const SocialIcon = styled(IconButton)(({ theme }) => ({
  color: theme.palette.grey[400],
  background: `${theme.palette.grey[700]}40`,
  '&:hover': {
    color: theme.palette.primary.light,
    background: `${theme.palette.primary.main}20`,
    transform: 'translateY(-2px)',
  },
}));

function Footer() {
  const navigate = useNavigate();

  const footerLinks = {
    Company: [
      { name: 'About Us', path: '/about' },
      { name: 'Our Story', path: '/story' },
      { name: 'Careers', path: '/careers' },
      { name: 'Press', path: '/press' },
    ],
    Community: [
      { name: 'Browse Stories', path: '/browse' },
      { name: 'Write Story', path: '/write' },
      { name: 'Guidelines', path: '/guidelines' },
      { name: 'Success Tips', path: '/tips' },
    ],
    Support: [
      { name: 'Help Center', path: '/help' },
      { name: 'Contact Us', path: '/contact' },
      { name: 'Privacy Policy', path: '/privacy' },
      { name: 'Terms of Service', path: '/terms' },
    ],
  };

  const socialLinks = [
    { icon: Twitter, label: 'Twitter', url: 'https://twitter.com/failfixes' },
    { icon: Facebook, label: 'Facebook', url: 'https://facebook.com/failfixes' },
    { icon: Instagram, label: 'Instagram', url: 'https://instagram.com/failfixes' },
    { icon: LinkedIn, label: 'LinkedIn', url: 'https://linkedin.com/company/failfixes' },
    { icon: GitHub, label: 'GitHub', url: 'https://github.com/failfixes' },
  ];

  return (
    <StyledFooter>
      <Container maxWidth="lg">
        <Box sx={{ py: 8 }}>
          <Grid container spacing={6}>
            {/* Brand Section */}
            <Grid item xs={12} md={4}>
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Box
                    sx={{
                      background: 'linear-gradient(135deg, #10b981, #34d399)',
                      borderRadius: '50%',
                      p: 1.5,
                    }}
                  >
                    <AutoFixHigh sx={{ fontSize: '2rem', color: 'white' }} />
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 900 }}>
                    FailFixes
                  </Typography>
                </Box>
                
                <Typography variant="body1" sx={{ 
                  color: 'grey.300', 
                  mb: 4,
                  lineHeight: 1.7,
                  fontSize: '1.0625rem',
                }}>
                  Transforming setbacks into comebacks. Join our community of resilient 
                  individuals sharing their inspiring journeys from failure to success.
                </Typography>

                <Stack direction="row" spacing={1}>
                  {socialLinks.map((social) => (
                    <SocialIcon
                      key={social.label}
                      aria-label={social.label}
                      onClick={() => window.open(social.url, '_blank')}
                    >
                      <social.icon />
                    </SocialIcon>
                  ))}
                </Stack>
              </Box>
            </Grid>

            {/* Links Sections */}
            {Object.entries(footerLinks).map(([category, links]) => (
              <Grid item xs={12} sm={6} md={2.67} key={category}>
                <Typography variant="h6" sx={{ 
                  fontWeight: 700, 
                  mb: 3,
                  color: 'white',
                  fontSize: '1.125rem',
                }}>
                  {category}
                </Typography>
                
                <Stack spacing={2}>
                  {links.map((link) => (
                    <FooterLink
                      key={link.name}
                      onClick={() => navigate(link.path)}
                    >
                      {link.name}
                    </FooterLink>
                  ))}
                </Stack>
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ my: 6, borderColor: 'grey.700' }} />

          {/* Bottom Section */}
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="body2" sx={{ color: 'grey.400' }}>
                © {new Date().getFullYear()} FailFixes. All rights reserved.
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ 
                display: 'flex', 
                gap: 3,
                alignItems: 'center',
                justifyContent: { xs: 'flex-start', md: 'flex-end' },
                flexWrap: 'wrap',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Email sx={{ fontSize: 18, color: 'primary.light' }} />
                  <Typography variant="body2" sx={{ color: 'grey.300' }}>
                    hello@failfixes.com
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Phone sx={{ fontSize: 18, color: 'primary.light' }} />
                  <Typography variant="body2" sx={{ color: 'grey.300' }}>
                    +1 (555) 123-4567
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationOn sx={{ fontSize: 18, color: 'primary.light' }} />
                  <Typography variant="body2" sx={{ color: 'grey.300' }}>
                    San Francisco, CA
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </StyledFooter>
  );
}

export default Footer;
