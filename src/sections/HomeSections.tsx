/**
 * HomeSections — the content sections below the three scenes, bundled as ONE lazy chunk so the
 * first paint (preloader + hero) does not wait for them. Home renders it right away (the download
 * starts on mount), and it is far below the fold behind ~5 viewports of pinned scenes.
 */
import About from './About'
import Services from './Services'
import Portfolio from './Portfolio'
import Ecosystem from './Ecosystem'
import Security from './Security'
import Why from './Why'
import Testimonials from './Testimonials'
import FaqPreview from './FaqPreview'
import Contact from './Contact'

export default function HomeSections() {
  return (
    <>
      <About />
      <Services />
      <Portfolio />
      <Ecosystem />
      <Security />
      <Why />
      <Testimonials />
      <FaqPreview />
      <Contact />
    </>
  )
}
