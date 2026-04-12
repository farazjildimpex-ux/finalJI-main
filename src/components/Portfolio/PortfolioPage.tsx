import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Globe, 
  Users, 
  Award, 
  TrendingUp, 
  Mail, 
  Phone, 
  MapPin,
  ArrowRight,
  CheckCircle,
  Truck,
  Shield,
  Clock,
  Star,
  Factory,
  Package,
  Calendar,
  MapPin as LocationIcon
} from 'lucide-react';

const PortfolioPage: React.FC = () => {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">JILD IMPEX</h1>
                <p className="text-sm text-blue-600 font-medium">Leather Import Export</p>
              </div>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#about" className="text-gray-700 hover:text-blue-600 transition-colors">About</a>
              <a href="#products" className="text-gray-700 hover:text-blue-600 transition-colors">Products</a>
              <a href="#services" className="text-gray-700 hover:text-blue-600 transition-colors">Services</a>
              <a href="#fairs" className="text-gray-700 hover:text-blue-600 transition-colors">Trade Fairs</a>
              <a href="#contact" className="text-gray-700 hover:text-blue-600 transition-colors">Contact</a>
            </nav>
            <button
              onClick={handleLoginClick}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Premium Leather Excellence
              </h2>
              <p className="text-2xl text-blue-600 font-semibold mb-8">
                JILD IMPEX - Your Trusted Leather Partner
              </p>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Sourcing and supplying the finest leather products to clients worldwide with uncompromising quality standards and professional service.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleLoginClick}
                  className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-all duration-300 font-semibold flex items-center justify-center group"
                >
                  Access Management System
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <a
                  href="#contact"
                  className="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-lg hover:bg-blue-600 hover:text-white transition-all duration-300 font-semibold text-center"
                >
                  Contact Us
                </a>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8">
                <img 
                  src="https://images.pexels.com/photos/267320/pexels-photo-267320.jpeg?auto=compress&cs=tinysrgb&w=800" 
                  alt="Premium Leather Dress Shoes" 
                  className="w-full h-64 object-cover rounded-xl mb-6"
                />
                <h3 className="text-xl font-bold text-gray-900 mb-4">Crafted Leather Excellence</h3>
                <p className="text-gray-600">
                  Experience the finest quality leather products, meticulously crafted for discerning clients worldwide.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">About JILD IMPEX</h3>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto">
              JILD IMPEX is a leading leather import-export company based in Chennai, India. 
              We specialize in sourcing and supplying high-quality leather products to clients worldwide.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h4 className="text-2xl font-bold text-gray-900 mb-6">Our Expertise</h4>
              <p className="text-gray-600 mb-6 leading-relaxed">
                With years of experience in the leather industry, JILD IMPEX has established itself 
                as a trusted partner for businesses seeking premium leather products. Our expertise 
                spans across various types of leather goods, from raw materials to finished products.
              </p>
              
              <div className="space-y-4">
                {[
                  'Premium Quality Leather Products',
                  'Global Import & Export Services',
                  'Competitive Pricing',
                  'Timely Delivery',
                  'Quality Assurance',
                  'Customer Satisfaction'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-8 shadow-xl">
              <h4 className="text-2xl font-bold text-gray-900 mb-6">Why Choose Us?</h4>
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="bg-blue-100 rounded-lg p-3 mr-4">
                    <Award className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900 mb-2">Quality Products</h5>
                    <p className="text-gray-600 text-sm">We ensure all our leather products meet international quality standards</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-green-100 rounded-lg p-3 mr-4">
                    <Globe className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900 mb-2">Global Network</h5>
                    <p className="text-gray-600 text-sm">Extensive network of suppliers and customers worldwide</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-purple-100 rounded-lg p-3 mr-4">
                    <Shield className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900 mb-2">Reliable Service</h5>
                    <p className="text-gray-600 text-sm">Committed to providing reliable and professional service</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Our Products</h3>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We deal in a wide range of leather products catering to various industries and applications.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: 'Finished Leather',
                description: 'High-quality finished leather for various applications including footwear, garments, and accessories.',
                icon: Package
              },
              {
                title: 'Raw Leather',
                description: 'Premium raw leather materials sourced from trusted suppliers for manufacturing purposes.',
                icon: Factory
              },
              {
                title: 'Leather Goods',
                description: 'Complete range of leather goods including bags, wallets, belts, and other accessories.',
                icon: Star
              },
              {
                title: 'Specialty Leather',
                description: 'Specialized leather products for specific industries and custom requirements.',
                icon: Award
              }
            ].map((product, index) => {
              const Icon = product.icon;
              return (
                <div key={index} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 group border border-blue-100">
                  <div className="bg-blue-100 rounded-xl p-4 w-fit mb-6 group-hover:bg-blue-200 transition-colors">
                    <Icon className="h-8 w-8 text-blue-600" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-3">{product.title}</h4>
                  <p className="text-gray-600 leading-relaxed">{product.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trade Fairs Section */}
      <section id="fairs" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Global Trade Fairs</h3>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              JILD IMPEX actively participates in major international leather trade fairs, 
              connecting with global partners and showcasing our premium products.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                name: 'APLF - Asia Pacific Leather Fair',
                location: 'Hong Kong',
                description: 'Asia\'s premier leather and fashion trade fair, connecting leather professionals from around the world.',
                logo: 'https://www.aplf.com/images/aplf-logo.png',
                frequency: 'Bi-annual',
                focus: 'Leather, Materials & Fashion'
              },
              {
                name: 'LINEAPELLE',
                location: 'Milan, Italy',
                description: 'The world\'s most important trade fair for leather, accessories, components, synthetics and models.',
                logo: 'https://www.lineapelle-fair.it/images/lineapelle-logo.png',
                frequency: 'Bi-annual',
                focus: 'Leather & Accessories'
              },
              {
                name: 'ACLE - All China Leather Exhibition',
                location: 'Shanghai, China',
                description: 'China\'s largest leather exhibition showcasing the latest trends and innovations in the leather industry.',
                logo: 'https://www.acle.cn/images/acle-logo.png',
                frequency: 'Annual',
                focus: 'Leather Manufacturing'
              },
              {
                name: 'LEATHER & FASHION',
                location: 'Istanbul, Turkey',
                description: 'Leading trade fair for leather, fur, and fashion accessories in the Eurasia region.',
                logo: 'https://www.leatherfashion.com.tr/images/lf-logo.png',
                frequency: 'Annual',
                focus: 'Fashion & Accessories'
              },
              {
                name: 'IILF - India International Leather Fair',
                location: 'Chennai & Kolkata, India',
                description: 'India\'s premier leather trade fair showcasing the country\'s leather manufacturing capabilities.',
                logo: 'https://www.iilf.in/images/iilf-logo.png',
                frequency: 'Bi-annual',
                focus: 'Indian Leather Industry'
              },
              {
                name: 'LEATHER TECH',
                location: 'Various Locations',
                description: 'Technology-focused leather trade fair highlighting innovations in leather processing and manufacturing.',
                logo: 'https://www.leathertech.com/images/lt-logo.png',
                frequency: 'Annual',
                focus: 'Technology & Innovation'
              }
            ].map((fair, index) => (
              <div key={index} className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 group">
                <div className="h-48 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="bg-white rounded-xl p-6 shadow-lg mb-4">
                      <h4 className="text-2xl font-bold text-blue-600">{fair.name.split(' - ')[0]}</h4>
                      {fair.name.includes(' - ') && (
                        <p className="text-sm text-gray-600 mt-1">{fair.name.split(' - ')[1]}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-center text-blue-600">
                      <LocationIcon className="h-5 w-5 mr-2" />
                      <span className="font-medium">{fair.location}</span>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-gray-600 mb-4 leading-relaxed">{fair.description}</p>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      {fair.frequency}
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1 rounded-full">
                      {fair.focus}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <div className="bg-blue-600 text-white rounded-2xl p-8 max-w-4xl mx-auto">
              <h4 className="text-2xl font-bold mb-4">Meet Us at Trade Fairs</h4>
              <p className="text-blue-100 mb-6 leading-relaxed">
                Visit our booth at these prestigious international leather trade fairs to explore our latest products, 
                discuss business opportunities, and experience our commitment to quality firsthand.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="#contact"
                  className="bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors font-semibold"
                >
                  Schedule a Meeting
                </a>
                <a
                  href="mailto:office@jildimpex.com"
                  className="border-2 border-white text-white px-8 py-3 rounded-lg hover:bg-white hover:text-blue-600 transition-colors font-semibold"
                >
                  Get Fair Schedule
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Our Services</h3>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive leather trade services to meet all your import and export requirements.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: 'Import Services',
                description: 'Professional import services for leather products from global suppliers with complete documentation and logistics support.',
                icon: Truck,
                features: ['Custom Clearance', 'Quality Inspection', 'Documentation', 'Logistics Management']
              },
              {
                title: 'Export Services',
                description: 'Comprehensive export solutions for leather manufacturers looking to expand their global reach.',
                icon: Globe,
                features: ['Market Research', 'Buyer Connections', 'Shipping Solutions', 'Export Documentation']
              },
              {
                title: 'Quality Assurance',
                description: 'Rigorous quality control processes ensuring all leather products meet required standards.',
                icon: Shield,
                features: ['Quality Testing', 'Certification', 'Inspection Services', 'Compliance Verification']
              },
              {
                title: 'Logistics Support',
                description: 'End-to-end logistics solutions for efficient and timely delivery of leather products.',
                icon: Clock,
                features: ['Warehousing', 'Transportation', 'Inventory Management', 'Timely Delivery']
              }
            ].map((service, index) => {
              const Icon = service.icon;
              return (
                <div key={index} className="bg-gray-50 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 group">
                  <div className="bg-blue-100 rounded-xl p-4 w-fit mb-6 group-hover:bg-blue-200 transition-colors">
                    <Icon className="h-8 w-8 text-blue-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-4">{service.title}</h4>
                  <p className="text-gray-600 mb-6 leading-relaxed">{service.description}</p>
                  <ul className="space-y-2">
                    {service.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center text-gray-700">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Contact Us</h3>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Get in touch with us for all your leather import-export requirements.
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-blue-100 rounded-full p-6 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-blue-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-4">Address</h4>
                <p className="text-gray-600 leading-relaxed">
                  New No:11, Old No:698, First Street<br />
                  Anna Nagar West Extension<br />
                  Chennai - 600101, Tamil Nadu, India
                </p>
              </div>
              
              <div className="text-center">
                <div className="bg-green-100 rounded-full p-6 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <Phone className="h-8 w-8 text-green-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-4">Phone</h4>
                <p className="text-gray-600 text-lg font-medium">+91 98410 91189</p>
              </div>
              
              <div className="text-center">
                <div className="bg-purple-100 rounded-full p-6 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <Mail className="h-8 w-8 text-purple-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-4">Email</h4>
                <p className="text-gray-600 text-lg font-medium">office@jildimpex.com</p>
              </div>
            </div>
            
            <div className="text-center mt-12">
              <p className="text-gray-600 mb-6">
                Ready to discuss your leather import-export needs? Contact us today for personalized service and competitive pricing.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="tel:+919841091189"
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold inline-flex items-center justify-center"
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Call Now
                </a>
                <a
                  href="mailto:office@jildimpex.com"
                  className="border-2 border-blue-600 text-blue-600 px-8 py-3 rounded-lg hover:bg-blue-600 hover:text-white transition-colors font-semibold inline-flex items-center justify-center"
                >
                  <Mail className="h-5 w-5 mr-2" />
                  Send Email
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <Building2 className="h-8 w-8 text-blue-400 mr-3" />
                <div>
                  <h3 className="text-xl font-bold">JILD IMPEX</h3>
                  <p className="text-gray-400 text-sm">Leather Import Export</p>
                </div>
              </div>
              <p className="text-gray-400 mb-4">
                Your trusted partner for premium leather import-export services.
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Contact Info</h4>
              <div className="space-y-2 text-gray-400">
                <p>New No:11, Old No:698, First Street</p>
                <p>Anna Nagar West Extension</p>
                <p>Chennai - 600101</p>
                <p>Phone: +91 98410 91189</p>
                <p>Email: office@jildimpex.com</p>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#products" className="hover:text-white transition-colors">Products</a></li>
                <li><a href="#services" className="hover:text-white transition-colors">Services</a></li>
                <li><a href="#fairs" className="hover:text-white transition-colors">Trade Fairs</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
                <li>
                  <button
                    onClick={handleLoginClick}
                    className="hover:text-white transition-colors"
                  >
                    Management Portal
                  </button>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 JILD IMPEX. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PortfolioPage;