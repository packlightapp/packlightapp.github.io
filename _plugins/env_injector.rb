module Jekyll
  class EnvInjector < Generator
    def generate(site)
      site.config['ck_api_token'] = ENV['CK_API_TOKEN'] || "61ae09ee1a16555deadea5bb183e5803e6d015c4964e870a92fbefd96b6d6a42e"
      site.config['ck_env'] = ENV['CK_ENV'] || "development"
    end
  end
end
