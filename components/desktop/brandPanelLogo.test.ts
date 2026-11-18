describe('brand panel logo source', () => {
  it('should use the vector artwork on the web, crisp on Retina screens', () => {
    const web = jest.requireActual('./brandPanelLogo.web').BRAND_PANEL_LOGO;
    expect(web).toEqual(jest.requireActual('@/assets/images/brand-panel-logo.svg'));
  });

  it('should keep the density-picked PNG on iOS and Android', () => {
    const native = jest.requireActual('./brandPanelLogo').BRAND_PANEL_LOGO;
    expect(native).toEqual(jest.requireActual('@/assets/images/brand-panel-logo.png'));
  });
});
